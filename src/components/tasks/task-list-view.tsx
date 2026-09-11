import { format } from "date-fns";
import { CheckSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PriorityBadge, StatusBadge } from "@/components/tasks/task-badges";
import { EmptyState } from "@/components/shared/empty-state";
import type { Task } from "@/types/database";

export function TaskListView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) {
  if (tasks.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Use the New task button above to add your first one."
        />
      </div>
    );
  }

  return (
    <div className="px-6 py-4">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Task</th>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 font-medium">Assignees</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {tasks.map((task) => (
              <tr key={task.id} onClick={() => onTaskClick(task)} className="cursor-pointer hover:bg-accent/50">
                <td className="px-4 py-2.5 font-medium">{task.title}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{task.project?.name ?? "—"}</td>
                <td className="px-4 py-2.5"><StatusBadge status={task.status} /></td>
                <td className="px-4 py-2.5"><PriorityBadge priority={task.priority} /></td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {task.due_date ? format(new Date(task.due_date), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex -space-x-1.5">
                    {task.assignees?.map((a) => (
                      <Avatar key={a.id} className="size-6 border-2 border-card">
                        <AvatarFallback className="text-[10px]">
                          {(a.profile?.full_name ?? a.profile?.email ?? "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
