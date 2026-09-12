import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { Company, CompanyMember } from "@/types/database";

export interface MyCompany extends CompanyMember {
  company: Company;
}

export function useMyCompanies() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_members")
        .select("*, company:companies(*)")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MyCompany[];
    },
  });
}

export function useUpdateCompany() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Company> & { id: string }) => {
      const { data, error } = await supabase.from("companies").update(patch).eq("id", id).select().single();
      if (error) throw error;
      if (patch.security_settings) {
        await supabase.rpc("log_audit_event", {
          p_company_id: id,
          p_action: "company.security_settings_changed",
          p_target_type: "company",
          p_target_id: id,
          p_metadata: patch.security_settings,
        });
      }
      return data as Company;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-companies", user?.id] }),
  });
}
