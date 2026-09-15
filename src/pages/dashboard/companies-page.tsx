import { Link } from "react-router-dom";
import { Building2, CheckSquare, Folders } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompanySummaries } from "@/hooks/use-companies-overview";
import { useWorkspace } from "@/hooks/use-workspace";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const MARK_COLORS = ["#0E7C86", "#8A5A1E", "#5B4B8A", "#3C6E4F", "#8A3E4B"];

export function CompaniesPage() {
  const { summaries, isLoading } = useCompanySummaries();
  const { company: currentCompany } = useWorkspace();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader
        title="Companies"
        description="Every OD Holdings company you're part of, in one place."
      />
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-7 sm:px-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {summaries.map((c, i) => (
              <Link
                key={c.id}
                to={`/w/${c.slug}`}
                className={cn(
                  "group flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
                  c.slug === currentCompany?.slug && "ring-2 ring-primary/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: MARK_COLORS[i % MARK_COLORS.length] }}
                  >
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display truncate text-base font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.industry ?? "No industry set"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 border-t pt-3.5 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Folders className="size-3.5" />
                    <span className="font-mono font-medium text-foreground">{c.activeProjects}</span> projects
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckSquare className="size-3.5" />
                    <span className="font-mono font-medium text-foreground">{c.openTasks}</span> open tasks
                  </span>
                  <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {ROLE_LABELS[c.role as keyof typeof ROLE_LABELS] ?? c.role}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
