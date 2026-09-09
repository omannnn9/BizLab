import { CalendarDays } from "lucide-react";
import { format, isPast } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/tasks/task-badges";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

export function TaskCard({
  task,
  onClick,
  draggable,
  onDragStart,
}: {
  task: Task;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const overdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "done";

  return (
    <button
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {task.project && (
        <span
          className="w-fit rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: `${task.project.color}1a`, color: task.project.color }}
        >
          {task.project.name}
        </span>
      )}
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span
              className={cn(
                "flex items-center gap-1 text-[11px]",
                overdue ? "text-destructive" : "text-muted-foreground"
              )}
            >
              <CalendarDays className="size-3" />
              {format(new Date(task.due_date), "MMM d")}
            </span>
          )}
          {task.assignees && task.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar key={a.id} className="size-5 border-2 border-card">
                  <AvatarFallback className="text-[9px]">
                    {(a.profile?.full_name ?? a.profile?.email ?? "?")[0]}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
