import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";
import type { ActivityLog } from "@/types/database";

export function useAuditLogs() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["audit-logs", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*, actor:profiles(*)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as ActivityLog[];
    },
  });
}
