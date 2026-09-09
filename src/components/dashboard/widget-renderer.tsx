import { formatDistanceToNow } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { formatBytes } from "@/lib/utils";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { useWorkspace } from "@/hooks/use-workspace";
import type { DashboardWidget } from "@/types/database";

const WIDGET_TITLES: Record<DashboardWidget["widget_type"], string> = {
  task_completion: "Task completion",
  team_productivity: "Team productivity",
  upcoming_deadlines: "Upcoming deadlines",
  storage_usage: "Storage usage",
  recent_activity: "Recent activity",
  projects_overview: "Projects overview",
  my_tasks: "My tasks",
  channel_activity: "Channel activity",
};

export function WidgetRenderer({ widget, onRemove }: { widget: DashboardWidget; onRemove?: () => void }) {
  const { data: stats, isLoading } = useDashboardStats();
  const { company } = useWorkspace();

  const title = widget.title || WIDGET_TITLES[widget.widget_type];

  if (isLoading || !stats) {
    return (
      <WidgetCard title={title} onRemove={onRemove}>
        <div className="h-16 animate-pulse rounded bg-muted" />
      </WidgetCard>
    );
  }

  switch (widget.widget_type) {
    case "task_completion": {
      const done = stats.tasks.filter((t) => t.status === "done").length;
      const total = stats.tasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      return (
        <WidgetCard title={title} onRemove={onRemove}>
          <div className="text-2xl font-semibold">{pct}%</div>
          <Progress value={pct} className="mt-2" />
          <p className="mt-2 text-xs text-muted-foreground">{done} of {total} tasks completed</p>
        </WidgetCard>
      );
    }

    case "my_tasks": {
      return (
        <WidgetCard title={title} onRemove={onRemove}>
          <div className="text-2xl font-semibold">{stats.myOpenTasks}</div>
          <p className="mt-1 text-xs text-muted-foreground">open tasks across the workspace</p>
        </WidgetCard>
      );
    }

    case "upcoming_deadlines": {
      const upcoming = stats.tasks
        .filter((t) => t.due_date && t.status !== "done")
        .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
        .slice(0, 5);
      return (
        <WidgetCard title={title} onRemove={onRemove} colSpan={2}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due soon.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{t.title}</span>
                  <Badge variant="outline">{new Date(t.due_date!).toLocaleDateString()}</Badge>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      );
    }

    case "storage_usage": {
      const used = stats.storage.used_bytes ?? 0;
      const quota = company?.storage_quota_bytes ?? 1;
      const pct = Math.min(100, Math.round((used / quota) * 100));
      return (
        <WidgetCard title={title} onRemove={onRemove}>
          <div className="text-2xl font-semibold">{formatBytes(used)}</div>
          <Progress value={pct} className="mt-2" />
          <p className="mt-2 text-xs text-muted-foreground">of {formatBytes(quota)} used</p>
        </WidgetCard>
      );
    }

    case "recent_activity": {
      return (
        <WidgetCard title={title} onRemove={onRemove} colSpan={2}>
          {stats.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {stats.activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="font-medium">{a.actor?.full_name ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{a.action.replace(/[._]/g, " ")}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      );
    }

    case "projects_overview": {
      return (
        <WidgetCard title={title} onRemove={onRemove} colSpan={2}>
          {stats.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.projects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <Badge variant="outline">{p.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      );
    }

    case "team_productivity": {
      return (
        <WidgetCard title={title} onRemove={onRemove}>
          <div className="text-2xl font-semibold">{stats.memberCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">active team members</p>
        </WidgetCard>
      );
    }

    default:
      return (
        <WidgetCard title={title} onRemove={onRemove}>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </WidgetCard>
      );
  }
}
