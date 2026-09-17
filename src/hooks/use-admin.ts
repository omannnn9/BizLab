import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { CompanyRole, Profile } from "@/types/database";

export interface AdminCompany {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  created_at: string;
  member_count: number;
  storage_quota_bytes: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor: Pick<Profile, "id" | "full_name" | "email"> | null;
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48) || "company"
  );
}

/** All users platform-wide — only resolves data for a platform admin; RLS returns an empty set otherwise. */
export function useAllProfiles() {
  return useQuery({
    queryKey: ["admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

/** All companies platform-wide, with a member count — admin-only via RLS. */
export function useAllCompanies() {
  return useQuery({
    queryKey: ["admin-all-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, slug, industry, created_at, storage_quota_bytes, company_members(count)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        member_count: (c as unknown as { company_members: { count: number }[] }).company_members?.[0]?.count ?? 0,
      })) as AdminCompany[];
    },
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      industry,
      userId,
    }: {
      name: string;
      industry?: string;
      userId: string;
    }) => {
      const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await supabase
        .from("companies")
        .insert({ name, slug, industry, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-all-companies"] });
      // The creator is added as owner by seed_company_defaults()
      // immediately, so their own workspace list is stale the instant
      // this resolves — matters when creating from the workspace
      // picker, which navigates straight into the new company.
      void queryClient.invalidateQueries({ queryKey: ["my-companies"] });
    },
  });
}

/** Direct table update, not an RPC: the "owners and admins can update
 * company" RLS policy already resolves a platform admin to 'owner' on
 * every company (current_role_in, 0022_internal_access_model.sql), so
 * no SECURITY DEFINER bypass is needed here the way it is for the
 * guarded profiles columns below. */
export function useUpdateCompanyStorageQuota() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, quotaBytes }: { companyId: string; quotaBytes: number }) => {
      const { error } = await supabase
        .from("companies")
        .update({ storage_quota_bytes: quotaBytes })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-all-companies"] }),
  });
}

export function useSetUserDisabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, disabled }: { userId: string; disabled: boolean }) => {
      const { error } = await supabase.rpc("admin_set_user_disabled", { p_user_id: userId, p_disabled: disabled });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-all-profiles"] }),
  });
}

export function useSetPlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      const { error } = await supabase.rpc("admin_set_platform_admin", { p_user_id: userId, p_is_admin: isAdmin });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-all-profiles"] }),
  });
}

/**
 * Fully deletes an account: auth.users row, profile, every company
 * membership. Content they created elsewhere (tasks, files, chat
 * messages, ...) survives, unattributed — see migration 0032 and
 * supabase/functions/delete-user. Goes through an edge function for
 * the same reason invite-user does: only the service-role Admin API
 * can touch auth.users, which an RLS-scoped client never can.
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user", { body: { user_id: userId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-all-profiles"] }),
  });
}

export function usePlatformAuditLog() {
  return useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, target_type, target_id, metadata, created_at, actor:profiles!audit_logs_actor_id_fkey(id, full_name, email)")
        .is("company_id", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as AuditLogEntry[];
    },
  });
}

/**
 * Invitations go through the invite-user edge function rather than a
 * direct table insert because provisioning a brand-new user's
 * auth.users row requires the service-role Admin API, which can only
 * run server-side — see supabase/functions/invite-user.
 */
export function useInviteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      email: string;
      full_name: string;
      company_id: string;
      role: CompanyRole;
      /** Required unless the email already has a BizLab account — see the
       * invite-user edge function: a brand-new user gets this password
       * directly rather than an invite email, and must change it on
       * first sign-in (PasswordChangeGuard). */
      temp_password?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: { ...input, redirectOrigin: window.location.origin },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { accountCreated: boolean };
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["invitations"] }),
  });
}
