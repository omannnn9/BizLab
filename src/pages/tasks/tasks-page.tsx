import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskCalendarView } from "@/components/tasks/task-calendar-view";
import { TaskTimelineView } from "@/components/tasks/task-timeline-view";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useTasks } from "@/hooks/use-tasks";
import type { Task } from "@/types/database";

type ViewMode = "list" | "kanban" | "calendar" | "timeline";

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const [view, setView] = useState<ViewMode>("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();

  function openCreate() {
    setEditingTask(undefined);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  // Deep-link support for notifications (task_assigned, task_due_soon,
  // comment_added) that link to /tasks?task={id} — without this the
  // link landed you on the generic list with no indication of which
  // task it meant, so delegating a task notified you but didn't
  // actually take you to it.
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (!taskId || !tasks) return;
    const target = tasks.find((t) => t.id === taskId);
    if (target) openEdit(target);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("task");
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, searchParams]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Tasks"
        description="Everything your team needs to get done, in one list."
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="list">List</TabsTrigger>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={openCreate}>
              <Plus /> New task
            </Button>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2 p-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          {view === "kanban" && <KanbanBoard tasks={tasks ?? []} onTaskClick={openEdit} />}
          {view === "list" && (
            <div className="h-full overflow-y-auto">
              <TaskListView tasks={tasks ?? []} onTaskClick={openEdit} />
            </div>
          )}
          {view === "calendar" && (
            <div className="h-full overflow-y-auto">
              <TaskCalendarView tasks={tasks ?? []} onTaskClick={openEdit} />
            </div>
          )}
          {view === "timeline" && (
            <div className="h-full overflow-y-auto">
              <TaskTimelineView tasks={tasks ?? []} onTaskClick={openEdit} />
            </div>
          )}
        </div>
      )}

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editingTask} />
    </div>
  );
}
