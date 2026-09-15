import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  CheckCircle2,
  Clock,
  Folders,
  HardDrive,
  Link2,
  ListTodo,
  MessagesSquare,
  Users,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WidgetCard } from "@/components/dashboard/widget-card";
import { QuickLinksWidget } from "@/components/dashboard/quick-links-widget";
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
  quick_links: "Quick links",
};

const WIDGET_ICONS: Record<DashboardWidget["widget_type"], typeof CheckCircle2> = {
  task_completion: CheckCircle2,
  team_productivity: Users,
  upcoming_deadlines: Clock,
  storage_usage: HardDrive,
  recent_activity: Activity,
  projects_overview: Folders,
  my_tasks: ListTodo,
  channel_activity: MessagesSquare,
  quick_links: Link2,
};

function initials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

export function WidgetRenderer({
  widget,
  dashboardId,
  onRemove,
}: {
  widget: DashboardWidget;
  dashboardId?: string;
  onRemove?: () => void;
}) {
  const { data: stats, isLoading } = useDashboardStats();
  const { company } = useWorkspace();

  const title = widget.title || WIDGET_TITLES[widget.widget_type];
  const icon = WIDGET_ICONS[widget.widget_type];

  if (widget.widget_type === "quick_links") {
    return (
      <WidgetCard title={title} icon={icon} onRemove={onRemove}>
        <QuickLinksWidget widget={widget} dashboardId={dashboardId} />
      </WidgetCard>
    );
  }

  if (isLoading || !stats) {
    return (
      <WidgetCard title={title} icon={icon} onRemove={onRemove}>
        <div className="h-16 animate-pulse rounded bg-muted" />
      </WidgetCard>
    );
  }

  switch (widget.widget_type) {
    case "task_completion": {
      const done = stats.tasks.filter((t) => t.status === "done").length;
      const total = stats.tasks.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const tone = pct >= 70 ? "success" : pct >= 35 ? "primary" : "warning";
      return (
        <WidgetCard title={title} icon={icon} tone={tone} onRemove={onRemove}>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{pct}%</div>
          <Progress
            value={pct}
            className="mt-3"
            indicatorClassName={tone === "success" ? "bg-success" : tone === "warning" ? "bg-warning" : undefined}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {done} of {total} task{total === 1 ? "" : "s"} completed
          </p>
        </WidgetCard>
      );
    }

    case "my_tasks": {
      return (
        <WidgetCard title={title} icon={icon} onRemove={onRemove}>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{stats.myOpenTasks}</div>
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
        <WidgetCard title={title} icon={icon} tone="warning" onRemove={onRemove} colSpan={2}>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due soon.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {upcoming.map((t) => {
                const days = daysUntil(t.due_date!);
                const overdue = days < 0;
                const soon = days <= 2;
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 text-sm">
                    <span className="truncate">{t.title}</span>
                    <Badge
                      variant={overdue ? "destructive" : soon ? "warning" : "outline"}
                      className="shrink-0 tabular-nums"
                    >
                      {overdue ? "Overdue" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </WidgetCard>
      );
    }

    case "storage_usage": {
      const used = stats.storage.used_bytes ?? 0;
      const quota = company?.storage_quota_bytes ?? 1;
      const pct = Math.min(100, Math.round((used / quota) * 100));
      const tone = pct >= 90 ? "destructive" : pct >= 70 ? "warning" : "primary";
      return (
        <WidgetCard title={title} icon={icon} tone={tone} onRemove={onRemove}>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{formatBytes(used)}</div>
          <Progress
            value={pct}
            className="mt-3"
            indicatorClassName={
              tone === "destructive" ? "bg-destructive" : tone === "warning" ? "bg-warning" : undefined
            }
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {pct}% of {formatBytes(quota)} used
          </p>
        </WidgetCard>
      );
    }

    case "recent_activity": {
      return (
        <WidgetCard title={title} icon={icon} onRemove={onRemove} colSpan={2}>
          {stats.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {stats.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback className="text-[10px]">{initials(a.actor?.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm">
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
        <WidgetCard title={title} icon={icon} onRemove={onRemove} colSpan={2}>
          {stats.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {stats.projects.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-2.5 py-2 text-sm first:pt-0 last:pb-0">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  <Badge variant="outline" className="shrink-0">
                    {p.status.replace("_", " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </WidgetCard>
      );
    }

    case "team_productivity": {
      return (
        <WidgetCard title={title} icon={icon} tone="success" onRemove={onRemove}>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">{stats.memberCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">active team members</p>
        </WidgetCard>
      );
    }

    case "channel_activity": {
      const top = stats.channelActivity.filter((c) => c.messageCount > 0).slice(0, 5);
      const max = Math.max(1, ...top.map((c) => c.messageCount));
      return (
        <WidgetCard title={title} icon={icon} onRemove={onRemove}>
          {top.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages in the last 7 days.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {top.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 truncate text-muted-foreground"># {c.name}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(6, (c.messageCount / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                    {c.messageCount}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Messages in the last 7 days</p>
        </WidgetCard>
      );
    }

    default:
      return (
        <WidgetCard title={title} icon={icon} onRemove={onRemove}>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </WidgetCard>
      );
  }
}

export { WIDGET_ICONS };
