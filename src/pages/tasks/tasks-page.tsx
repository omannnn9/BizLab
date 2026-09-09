import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskCalendarView } from "@/components/tasks/task-calendar-view";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { useTasks } from "@/hooks/use-tasks";
import type { Task } from "@/types/database";

type ViewMode = "list" | "kanban" | "calendar";

export function TasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const [view, setView] = useState<ViewMode>("kanban");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  function openCreate() {
    setEditingTask(undefined);
    setDialogOpen(true);
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDialogOpen(true);
  }

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
        </div>
      )}

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editingTask} />
    </div>
  );
}
