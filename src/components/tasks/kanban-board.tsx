import { useState } from "react";
import { KANBAN_COLUMNS, STATUS_LABELS } from "@/components/tasks/task-badges";
import { TaskCard } from "@/components/tasks/task-card";
import { useUpdateTask } from "@/hooks/use-tasks";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types/database";

export function KanbanBoard({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const updateTask = useUpdateTask();
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  function handleDrop(status: TaskStatus, e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/task-id");
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== status) {
      void updateTask.mutateAsync({ id: taskId, status });
    }
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {KANBAN_COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column);
        return (
          <div
            key={column}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(column);
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(column, e)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
              dragOverColumn === column && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-medium">{STATUS_LABELS[column]}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {columnTasks.length}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/task-id", task.id)}
                  onClick={() => onTaskClick(task)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
