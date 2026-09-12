import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";
import { downloadCsv } from "@/lib/csv";
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

/** Full (uncapped) audit trail export for compliance reporting — the
 * viewer above is intentionally limited to the most recent 50 rows. */
export function useExportComplianceReport() {
  const { company } = useWorkspace();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("created_at, action, target_type, target_id, actor:profiles(full_name, email), metadata")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("No audit events to export yet");

      const rows = data.map((row) => {
        const actor = row.actor as unknown as { full_name: string | null; email: string } | null;
        return {
          timestamp: row.created_at,
          action: row.action,
          actor_name: actor?.full_name ?? "",
          actor_email: actor?.email ?? "",
          target_type: row.target_type ?? "",
          target_id: row.target_id ?? "",
          metadata: JSON.stringify(row.metadata ?? {}),
        };
      });
      downloadCsv(`${company!.slug}-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`, rows);
      return rows.length;
    },
  });
}
