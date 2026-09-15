import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckSquare,
  Clock,
  FileText,
  Folders,
  PenTool,
  Plus,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { useMyWorkTasks } from "@/hooks/use-my-work";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { useMyCompanies } from "@/hooks/use-companies";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

export function HomePage() {
  const { profile } = useAuth();
  const { company } = useWorkspace();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: myWork, isLoading: myWorkLoading } = useMyWorkTasks();
  const { data: companies } = useMyCompanies();

  const isLoading = statsLoading || myWorkLoading;
  const firstName = profile?.full_name?.split(" ")[0];

  const focus = (myWork?.assignedToMe ?? [])
    .filter((t) => t.status !== "done" && t.status !== "cancelled" && t.due_date)
    .filter((t) => daysUntil(t.due_date!) <= 0)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

  const upcoming = (stats?.tasks ?? [])
    .filter((t) => t.due_date && t.status !== "done" && daysUntil(t.due_date) > 0)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 5);

  const tasksDueThisWeek = (stats?.tasks ?? []).filter(
    (t) => t.due_date && t.status !== "done" && daysUntil(t.due_date) >= 0 && daysUntil(t.due_date) <= 7
  ).length;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b bg-gradient-to-b from-primary/5 to-transparent px-6 py-7 sm:px-8">
        <p className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {greeting()}{firstName ? `, ${firstName}` : ""}.
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {company?.name ?? "Your workspace"} is active
          {(companies?.length ?? 0) > 1 ? ` · ${companies!.length} companies` : ""}
          {typeof stats?.projects.length === "number" ? ` · ${stats.projects.length} active project${stats.projects.length === 1 ? "" : "s"}` : ""}
          {` · ${tasksDueThisWeek} task${tasksDueThisWeek === 1 ? "" : "s"} due this week`}
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-7 sm:px-8">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="../tasks"><Plus className="size-3.5" /> New task</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="../documents"><FileText className="size-3.5" /> New document</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="../files"><Upload className="size-3.5" /> Upload file</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="../whiteboards"><PenTool className="size-3.5" /> New whiteboard</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Today's focus */}
          <section className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display flex items-center gap-2 text-base font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                  <Clock className="size-3.5" />
                </span>
                Today's focus
              </h2>
              <Link to="my-work" className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                My Work <ArrowRight className="size-3" />
              </Link>
            </div>
            {isLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            ) : focus.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="You're all caught up"
                description="Nothing assigned to you is due or overdue right now."
              />
            ) : (
              <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                {focus.slice(0, 6).map((t) => {
                  const days = daysUntil(t.due_date!);
                  const overdue = days < 0;
                  return (
                    <Link
                      key={t.id}
                      to={`../tasks?task=${t.id}`}
                      className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 hover:bg-accent/50"
                    >
                      {t.project && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: t.project.color }} />}
                      <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      <Badge variant={overdue ? "destructive" : "warning"} className="shrink-0">
                        {overdue ? "Overdue" : "Today"}
                      </Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Upcoming deadlines */}
          <section>
            <h2 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="flex size-6 items-center justify-center rounded-md bg-warning/20 text-warning">
                <Clock className="size-3.5" />
              </span>
              Upcoming deadlines
            </h2>
            {isLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing on the horizon.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {upcoming.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{t.title}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {new Date(t.due_date!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent activity */}
          <section className="lg:col-span-2">
            <h2 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Activity className="size-3.5" />
              </span>
              Recent activity
            </h2>
            {isLoading ? (
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
            ) : (stats?.activity.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="flex flex-col divide-y rounded-lg border bg-card px-4 shadow-sm">
                {stats!.activity.slice(0, 6).map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5 py-3">
                    <Avatar className="size-6 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {(a.actor?.full_name ?? "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </AvatarFallback>
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
          </section>

          {/* Active projects */}
          <section>
            <h2 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
              <span className="flex size-6 items-center justify-center rounded-md bg-success/15 text-success">
                <Folders className="size-3.5" />
              </span>
              Active projects
            </h2>
            {isLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-muted" />
            ) : (stats?.projects.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {stats!.projects.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`../projects/${p.id}`}
                      className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent")}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="flex-1 truncate">{p.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
