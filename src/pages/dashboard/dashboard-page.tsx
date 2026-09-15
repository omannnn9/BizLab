import { useEffect, useState } from "react";
import { LayoutDashboard, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { WidgetRenderer, WIDGET_ICONS } from "@/components/dashboard/widget-renderer";
import {
  useAddWidget,
  useCreateDashboard,
  useDashboard,
  useDashboards,
  useDeleteDashboard,
  useRemoveWidget,
  useReorderWidgets,
} from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
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

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });

export function DashboardPage() {
  const { profile, user } = useAuth();
  const { company } = useWorkspace();
  const { data: dashboards } = useDashboards();
  const [activeDashboardId, setActiveDashboardId] = useState<string>();
  const createDashboard = useCreateDashboard();
  const deleteDashboard = useDeleteDashboard();

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
  const { can } = usePermissions();

  // Must mirror the dashboard_widgets RLS policy (0008_dashboards.sql):
  // a personal dashboard's owner can always edit it; the shared/default
  // company dashboard (owner_id null) needs manager+.
  const canEditWidgets = !dashboard || dashboard.owner_id === user?.id || (dashboard.owner_id === null && can("dashboards", "manage"));
  const canDeleteDashboard = !!dashboard && !dashboard.is_default && dashboard.owner_id === user?.id;

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

  async function handleDeleteDashboard() {
    if (!dashboard || !dashboards) return;
    if (!window.confirm(`Delete "${dashboard.name}"? This removes all of its widgets and can't be undone.`)) return;
    const fallback = dashboards.find((d) => d.id !== dashboard.id && d.is_default) ?? dashboards.find((d) => d.id !== dashboard.id);
    await deleteDashboard.mutateAsync(dashboard.id);
    setActiveDashboardId(fallback?.id);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4 border-b bg-gradient-to-b from-primary/5 to-transparent px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutDashboard className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {company?.name ? `${company.name} · ` : ""}
              {WEEKDAY.format(new Date())}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canDeleteDashboard && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void handleDeleteDashboard()}
              title="Delete this dashboard"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          {canEditWidgets && dashboard && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Plus /> Add widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {AVAILABLE_WIDGETS.map((w) => {
                  const Icon = WIDGET_ICONS[w.type];
                  return (
                    <DropdownMenuItem key={w.type} onClick={() => addWidget.mutate(w.type)}>
                      <Icon className="size-3.5 text-muted-foreground" />
                      {w.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <EmptyState
                icon={LayoutDashboard}
                title="No widgets yet"
                description={
                  canEditWidgets
                    ? "Add a widget above to start building out this dashboard."
                    : "This dashboard doesn't have any widgets yet."
                }
                className="col-span-full"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
