import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ListTodo, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyWorkTasks, type MyWorkTask } from "@/hooks/use-my-work";
import { cn } from "@/lib/utils";

function daysUntil(dateStr: string) {
  const ms = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

function TaskRow({ task, showDue = true }: { task: MyWorkTask; showDue?: boolean }) {
  const days = task.due_date ? daysUntil(task.due_date) : null;
  const overdue = days !== null && days < 0;
  const done = task.status === "done";
  return (
    <Link
      to={`../tasks?task=${task.id}`}
      className="flex items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0 hover:bg-accent/50"
    >
      {task.project && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />}
      <span className={cn("min-w-0 flex-1 truncate font-medium", done && "text-muted-foreground line-through")}>
        {task.title}
      </span>
      {task.project && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{task.project.name}</span>}
      {showDue && task.due_date && (
        <Badge variant={overdue && !done ? "destructive" : "outline"} className="shrink-0 font-mono">
          {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
        </Badge>
      )}
    </Link>
  );
}

function Section({
  title,
  icon: Icon,
  tone,
  tasks,
  emptyLabel,
  showDue = true,
}: {
  title: string;
  icon: typeof Clock;
  tone: "primary" | "warning" | "success" | "destructive";
  tasks: MyWorkTask[];
  emptyLabel: string;
  showDue?: boolean;
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "warning"
        ? "bg-warning/20 text-warning"
        : tone === "success"
          ? "bg-success/15 text-success"
          : "bg-destructive/10 text-destructive";
  return (
    <section>
      <h2 className="font-display mb-3 flex items-center gap-2 text-base font-semibold">
        <span className={cn("flex size-6 items-center justify-center rounded-md", toneClass)}>
          <Icon className="size-3.5" />
        </span>
        {title}
        <span className="font-mono text-xs font-normal text-muted-foreground">{tasks.length}</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} showDue={showDue} />
          ))}
        </div>
      )}
    </section>
  );
}

export function MyWorkPage() {
  const { data, isLoading } = useMyWorkTasks();

  const assignedOpen = (data?.assignedToMe ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled");
  const today = assignedOpen.filter((t) => t.due_date && daysUntil(t.due_date) <= 0);
  const thisWeek = assignedOpen.filter((t) => t.due_date && daysUntil(t.due_date) > 0 && daysUntil(t.due_date) <= 7);
  const noDueDate = assignedOpen.filter((t) => !t.due_date);
  const recentlyCompleted = (data?.assignedToMe ?? [])
    .filter((t) => t.status === "done" && t.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 6);
  const waitingOnOthers = data?.waitingOnOthers ?? [];

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <PageHeader title="My Work" description="Everything assigned to you, and everything you're waiting on." />
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-7 sm:px-8">
        {isLoading ? (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : assignedOpen.length === 0 && waitingOnOthers.length === 0 && recentlyCompleted.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="Nothing on your plate"
            description="You have no open tasks assigned to you and nothing waiting on anyone else."
          />
        ) : (
          <>
            <Section title="Today" icon={Clock} tone="destructive" tasks={today} emptyLabel="Nothing due today. You're clear." />
            <Section title="This week" icon={Clock} tone="warning" tasks={thisWeek} emptyLabel="Nothing due in the next 7 days." />
            {noDueDate.length > 0 && (
              <Section title="No deadline yet" icon={ListTodo} tone="primary" tasks={noDueDate} emptyLabel="" showDue={false} />
            )}
            <Section
              title="Waiting on others"
              icon={UserCheck}
              tone="primary"
              tasks={waitingOnOthers}
              emptyLabel="Nothing you've delegated is still open."
            />
            <Section
              title="Recently completed"
              icon={CheckCircle2}
              tone="success"
              tasks={recentlyCompleted}
              emptyLabel="Nothing completed yet."
              showDue={false}
            />
          </>
        )}
      </div>
    </div>
  );
}
