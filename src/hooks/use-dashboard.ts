import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Dashboard, DashboardWidget, WidgetType } from "@/types/database";

export function useDefaultDashboard() {
  const { company } = useWorkspace();

  return useQuery({
    queryKey: ["dashboard", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*, dashboard_widgets(*)")
        .eq("company_id", company!.id)
        .eq("is_default", true)
        .single();
      if (error) throw error;
      return data as unknown as Dashboard & { dashboard_widgets: DashboardWidget[] };
    },
  });
}

export function useAddWidget(dashboardId: string | undefined) {
  const queryClient = useQueryClient();
  const { company } = useWorkspace();

  return useMutation({
    mutationFn: async (widgetType: WidgetType) => {
      const { error } = await supabase
        .from("dashboard_widgets")
        .insert({ dashboard_id: dashboardId!, widget_type: widgetType });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dashboard", company?.id] }),
  });
}

export function useRemoveWidget() {
  const queryClient = useQueryClient();
  const { company } = useWorkspace();

  return useMutation({
    mutationFn: async (widgetId: string) => {
      const { error } = await supabase.from("dashboard_widgets").delete().eq("id", widgetId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dashboard", company?.id] }),
  });
}

export function useDashboardStats() {
  const { company } = useWorkspace();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-stats", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const companyId = company!.id;
      const [tasks, projects, files, activity, members] = await Promise.all([
        supabase.from("tasks").select("id,status,priority,due_date,title,completed_at").eq("company_id", companyId),
        supabase.from("projects").select("id,name,status,color").eq("company_id", companyId).eq("is_archived", false),
        supabase.from("company_storage_usage").select("*").eq("company_id", companyId).maybeSingle(),
        supabase
          .from("activity_logs")
          .select("*, actor:profiles(*)")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.from("company_members").select("id").eq("company_id", companyId).eq("status", "active"),
      ]);

      return {
        tasks: tasks.data ?? [],
        projects: projects.data ?? [],
        storage: files.data ?? { used_bytes: 0, file_count: 0 },
        activity: activity.data ?? [],
        memberCount: members.data?.length ?? 0,
        myOpenTasks: (tasks.data ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled").length,
        currentUserId: user?.id,
      };
    },
  });
}
