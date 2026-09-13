import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import {
  useAddWidget,
  useCreateDashboard,
  useDashboard,
  useDashboards,
  useRemoveWidget,
  useReorderWidgets,
} from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import type { DashboardWidget, WidgetType } from "@/types/database";

const AVAILABLE_WIDGETS: { type: WidgetType; label: string }[] = [
  { type: "task_completion", label: "Task completion" },
  { type: "my_tasks", label: "My tasks" },
  { type: "upcoming_deadlines", label: "Upcoming deadlines" },
  { type: "storage_usage", label: "Storage usage" },
  { type: "recent_activity", label: "Recent activity" },
  { type: "projects_overview", label: "Projects overview" },
  { type: "team_productivity", label: "Team productivity" },
  { type: "channel_activity", label: "Channel activity" },
  { type: "quick_links", label: "Quick links" },
];

export function DashboardPage() {
  const { profile, user } = useAuth();
  const { data: dashboards } = useDashboards();
  const [activeDashboardId, setActiveDashboardId] = useState<string>();
  const createDashboard = useCreateDashboard();

  useEffect(() => {
    if (!activeDashboardId && dashboards && dashboards.length > 0) {
      setActiveDashboardId(dashboards.find((d) => d.is_default)?.id ?? dashboards[0].id);
    }
  }, [dashboards, activeDashboardId]);

  const { data: dashboard, isLoading } = useDashboard(activeDashboardId);
  const addWidget = useAddWidget(activeDashboardId);
  const removeWidget = useRemoveWidget(activeDashboardId);
  const reorderWidgets = useReorderWidgets(activeDashboardId);
  const [dragId, setDragId] = useState<string | null>(null);

  const canEditWidgets = !dashboard || dashboard.owner_id === user?.id || dashboard.owner_id === null;

  function handleDrop(targetWidget: DashboardWidget) {
    if (!dashboard || !dragId || dragId === targetWidget.id) return;
    const widgets = [...dashboard.dashboard_widgets];
    const fromIndex = widgets.findIndex((w) => w.id === dragId);
    const toIndex = widgets.findIndex((w) => w.id === targetWidget.id);
    const [moved] = widgets.splice(fromIndex, 1);
    widgets.splice(toIndex, 0, moved);
    reorderWidgets.mutate(widgets);
    setDragId(null);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Here's what's happening across your workspace."
        actions={
          canEditWidgets && dashboard ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus /> Add widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {AVAILABLE_WIDGETS.map((w) => (
                  <DropdownMenuItem key={w.type} onClick={() => addWidget.mutate(w.type)}>
                    {w.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : undefined
        }
      />

      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between">
          <Tabs value={activeDashboardId} onValueChange={setActiveDashboardId}>
            <TabsList>
              {dashboards?.map((d) => (
                <TabsTrigger key={d.id} value={d.id}>
                  {d.is_default ? "Workspace" : d.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const d = await createDashboard.mutateAsync("My dashboard");
              setActiveDashboardId(d.id);
            }}
          >
            <Plus className="size-3.5" /> Personal dashboard
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading || !dashboard ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.dashboard_widgets.map((widget) => (
              <div
                key={widget.id}
                draggable={canEditWidgets}
                onDragStart={() => setDragId(widget.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(widget)}
                className="contents"
              >
                <WidgetRenderer
                  widget={widget}
                  dashboardId={activeDashboardId}
                  onRemove={canEditWidgets ? () => removeWidget.mutate(widget.id) : undefined}
                />
              </div>
            ))}
            {dashboard.dashboard_widgets.length === 0 && (
              <p className="text-sm text-muted-foreground">No widgets yet — add one above.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
