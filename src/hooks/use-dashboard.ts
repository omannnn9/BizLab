import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Dashboard, DashboardWidget, WidgetType } from "@/types/database";

type DashboardWithWidgets = Dashboard & { dashboard_widgets: DashboardWidget[] };

function sortWidgets(dashboard: DashboardWithWidgets): DashboardWithWidgets {
  return {
    ...dashboard,
    dashboard_widgets: [...dashboard.dashboard_widgets].sort(
      (a, b) => (a.layout?.x ?? 0) - (b.layout?.x ?? 0)
    ),
  };
}

/** Every dashboard the current user can see: the shared workspace one
 * plus any personal dashboards they own. */
export function useDashboards() {
  const { company } = useWorkspace();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboards", company?.id, user?.id],
    enabled: !!company && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .eq("company_id", company!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Dashboard[];
    },
  });
}

export function useDashboard(dashboardId: string | undefined) {
  return useQuery({
    queryKey: ["dashboard", dashboardId],
    enabled: !!dashboardId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*, dashboard_widgets(*)")
        .eq("id", dashboardId!)
        .single();
      if (error) throw error;
      return sortWidgets(data as unknown as DashboardWithWidgets);
    },
  });
}

export function useDefaultDashboard() {
  const { company } = useWorkspace();

  return useQuery({
    queryKey: ["dashboard", "default", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboards")
        .select("*, dashboard_widgets(*)")
        .eq("company_id", company!.id)
        .eq("is_default", true)
        .single();
      if (error) throw error;
      return sortWidgets(data as unknown as DashboardWithWidgets);
    },
  });
}

export function useCreateDashboard() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("dashboards")
        .insert({ company_id: company!.id, name, owner_id: user!.id, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Dashboard;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dashboards", company?.id] }),
  });
}

/** RLS ("owner or managers delete dashboards", 0008_dashboards.sql)
 * refuses to delete the shared default dashboard even for an owner —
 * `and not is_default` in the policy — so this only ever removes a
 * personal one. */
export function useDeleteDashboard() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dashboards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dashboards", company?.id] }),
  });
}

export function useAddWidget(dashboardId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgetType: WidgetType) => {
      const { error } = await supabase
        .from("dashboard_widgets")
        .insert({ dashboard_id: dashboardId!, widget_type: widgetType, layout: { x: 999, y: 0, w: 4, h: 3 } });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "default"] });
    },
  });
}

export function useUpdateWidgetConfig(dashboardId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ widgetId, config }: { widgetId: string; config: Record<string, unknown> }) => {
      const { error } = await supabase.from("dashboard_widgets").update({ config }).eq("id", widgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "default"] });
    },
  });
}

export function useRemoveWidget(dashboardId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (widgetId: string) => {
      const { error } = await supabase.from("dashboard_widgets").delete().eq("id", widgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "default"] });
    },
  });
}

/** Persists drag-and-drop reordering: widget layouts store an `x` used
 * purely as a sort order (there's no real grid engine — a reorderable
 * list, not a resizable free-form grid). */
export function useReorderWidgets(dashboardId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedWidgets: DashboardWidget[]) => {
      await Promise.all(
        orderedWidgets.map((w, index) =>
          supabase
            .from("dashboard_widgets")
            .update({ layout: { ...w.layout, x: index } })
            .eq("id", w.id)
        )
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", dashboardId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", "default"] });
    },
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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [tasks, projects, files, activity, members, channels, recentMessages] = await Promise.all([
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
        supabase.from("chat_channels").select("id,name").eq("company_id", companyId).eq("is_archived", false),
        // is_channel_member() further narrows this to channels the
        // viewer can actually see, same as the Chat page itself.
        supabase
          .from("chat_messages")
          .select("channel_id, chat_channels!inner(company_id)")
          .eq("chat_channels.company_id", companyId)
          .is("deleted_at", null)
          .gte("created_at", sevenDaysAgo),
      ]);

      const messageCountByChannel = new Map<string, number>();
      for (const m of recentMessages.data ?? []) {
        messageCountByChannel.set(m.channel_id, (messageCountByChannel.get(m.channel_id) ?? 0) + 1);
      }
      const channelActivity = (channels.data ?? [])
        .map((c) => ({ id: c.id, name: c.name ?? "Unnamed", messageCount: messageCountByChannel.get(c.id) ?? 0 }))
        .sort((a, b) => b.messageCount - a.messageCount);

      return {
        tasks: tasks.data ?? [],
        projects: projects.data ?? [],
        storage: files.data ?? { used_bytes: 0, file_count: 0 },
        activity: activity.data ?? [],
        memberCount: members.data?.length ?? 0,
        myOpenTasks: (tasks.data ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled").length,
        currentUserId: user?.id,
        channelActivity,
      };
    },
  });
}
