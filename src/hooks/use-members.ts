import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";
import type { CompanyInvitation, CompanyMember, CompanyRole } from "@/types/database";

export function useCompanyMembers() {
  const { company } = useWorkspace();

  return useQuery({
    queryKey: ["company-members", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("*, profile:profiles(*)")
        .eq("company_id", company!.id)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CompanyMember[];
    },
  });
}

export function usePendingInvitations() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["invitations", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_invitations")
        .select("*")
        .eq("company_id", company!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompanyInvitation[];
    },
  });
}

export function useUpdateMemberRole() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: CompanyRole }) => {
      const { error } = await supabase.from("company_members").update({ role }).eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["company-members", company?.id] }),
  });
}

export function useRemoveMember() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from("company_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["company-members", company?.id] }),
  });
}
