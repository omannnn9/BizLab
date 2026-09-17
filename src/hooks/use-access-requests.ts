import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { AccessRequest } from "@/types/database";

/** Public submission — no auth required. RLS ("anyone can submit an
 * access request") only accepts a fresh, unreviewed, pending row; the
 * partial unique index on (email) where status='pending' means a
 * second submission from the same address while one is still pending
 * fails with a 23505, surfaced as a friendly "already pending" error. */
export function useSubmitAccessRequest() {
  return useMutation({
    mutationFn: async (input: { email: string; full_name: string; message?: string }) => {
      const { error } = await supabase.from("access_requests").insert({
        email: input.email.trim().toLowerCase(),
        full_name: input.full_name.trim() || null,
        message: input.message?.trim() || null,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("There's already a pending request for this email — sit tight, an admin will review it.");
        }
        throw error;
      }
    },
  });
}

/** Platform-admin only via RLS ("platform admins view access requests"). */
export function useAccessRequests() {
  return useQuery({
    queryKey: ["admin-access-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AccessRequest[];
    },
  });
}

/** Approve/deny only ever goes through admin_review_access_request —
 * reviewed_by/reviewed_at are set server-side so they can't be spoofed
 * (same shape as admin_set_user_disabled/admin_set_platform_admin). */
export function useReviewAccessRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      const { error } = await supabase.rpc("admin_review_access_request", { p_id: id, p_approved: approved });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["admin-access-requests"] }),
  });
}
