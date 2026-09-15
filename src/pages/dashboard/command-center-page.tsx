import { Link } from "react-router-dom";
import { AlertTriangle, Building2, CheckSquare, Folders, ShieldAlert, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCommandCenterData } from "@/hooks/use-companies-overview";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Building2 }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div>
        <div className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function CommandCenterPage() {
  const { profile } = useAuth();
  const { health, criticalDeadlines, totals, isLoading } = useCommandCenterData();

  if (!profile?.is_platform_admin) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">Platform admin only</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The Command Center rolls up every OD Holdings company — it's only shown to platform admins.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader title="Command Center" description="Every OD Holdings company, at a glance." />
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-7 sm:px-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatTile label="Companies" value={totals.companies} icon={Building2} />
            <StatTile label="Members" value={totals.members} icon={Users} />
            <StatTile label="Active projects" value={totals.activeProjects} icon={Folders} />
            <StatTile label="Open tasks" value={totals.openTasks} icon={CheckSquare} />
            <StatTile label="Overdue" value={totals.overdueTasks} icon={AlertTriangle} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <h2 className="font-display mb-3 text-base font-semibold">Company health</h2>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                {health.map((c) => (
                  <Link
                    key={c.id}
                    to={`/w/${c.slug}`}
                    className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0 hover:bg-accent/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.activeProjects} projects · {c.openTasks} open tasks
                        {c.overdueTasks > 0 ? ` · ${c.overdueTasks} overdue` : ""}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <Progress
                        value={c.completionRate}
                        className="h-1.5"
                        indicatorClassName={cn(
                          c.completionRate >= 70 ? "bg-success" : c.completionRate >= 35 ? "bg-primary" : "bg-warning"
                        )}
                      />
                      <p className="mt-1 text-right font-mono text-[11px] text-muted-foreground">{c.completionRate}% done</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-display mb-3 text-base font-semibold">Critical deadlines</h2>
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : criticalDeadlines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing urgent across the portfolio.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {criticalDeadlines.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate">{d.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.companyName}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-mono">
                      {new Date(d.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Badge>
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
