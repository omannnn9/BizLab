import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { TaskListView } from "@/components/tasks/task-list-view";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { EntityLoadGuard } from "@/components/shared/entity-load-guard";
import { useDeleteProject, useProject } from "@/hooks/use-projects";
import { useTasks } from "@/hooks/use-tasks";
import { useCreateMilestone, useDeleteMilestone, useMilestones, useUpdateMilestone } from "@/hooks/use-milestones";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Task } from "@/types/database";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading: projectLoading, isError: projectError } = useProject(projectId);
  const { data: tasks, isLoading } = useTasks({ projectId });
  const { data: milestones } = useMilestones(projectId);
  const createMilestone = useCreateMilestone(projectId!);
  const updateMilestone = useUpdateMilestone(projectId!);
  const deleteMilestone = useDeleteMilestone(projectId!);
  const deleteProject = useDeleteProject();
  const { can } = usePermissions();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  // Mirrors "managers+ manage milestones" RLS — reuse the projects.edit
  // threshold (also "manager"), since milestones live under a project.
  const canManageMilestones = can("projects", "edit");

  async function handleToggleMilestone(id: string, checked: boolean) {
    try {
      await updateMilestone.mutateAsync({ id, status: checked ? "completed" : "upcoming" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update milestone");
    }
  }

  async function handleDeleteMilestone(id: string) {
    try {
      await deleteMilestone.mutateAsync(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete milestone");
    }
  }

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();
  const [milestoneName, setMilestoneName] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  async function handleDeleteProject() {
    if (!project) return;
    if (
      !window.confirm(
        `Delete "${project.name}"? This permanently deletes every task and milestone in this project too — it can't be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteProject.mutateAsync(project.id);
      navigate(`/w/${company?.slug}/projects`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete project");
    }
  }

  const done = tasks?.filter((t) => t.status === "done").length ?? 0;
  const total = tasks?.length ?? 0;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  if (projectLoading || projectError || !project) {
    return (
      <EntityLoadGuard
        isLoading={projectLoading}
        isError={projectError}
        backTo={`/w/${company?.slug}/projects`}
        backLabel="Back to projects"
        notFoundMessage="This project doesn't exist or you don't have access to it."
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={project.name}
        description={project.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">{project.status.replace("_", " ")}</Badge>
            {can("projects", "delete") && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => void handleDeleteProject()}
                disabled={deleteProject.isPending}
                title="Delete project"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        }
      />

      <div className="border-b px-6 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{done} / {total} tasks complete</span>
        </div>
        <Progress value={progress} className="mt-1.5" />
      </div>

      <Tabs defaultValue="tasks" className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-2 px-6 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
              <TabsList>
                <TabsTrigger value="kanban">Kanban</TabsTrigger>
                <TabsTrigger value="list">List</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              onClick={() => {
                setEditingTask(undefined);
                setDialogOpen(true);
              }}
            >
              <Plus /> Task
            </Button>
          </div>
        </div>

        <TabsContent value="tasks" className="flex-1 overflow-hidden">
          {!isLoading &&
            (view === "kanban" ? (
              <KanbanBoard
                tasks={tasks ?? []}
                onTaskClick={(t) => {
                  setEditingTask(t);
                  setDialogOpen(true);
                }}
              />
            ) : (
              <div className="h-full overflow-y-auto">
                <TaskListView
                  tasks={tasks ?? []}
                  onTaskClick={(t) => {
                    setEditingTask(t);
                    setDialogOpen(true);
                  }}
                />
              </div>
            ))}
        </TabsContent>

        <TabsContent value="milestones" className="flex-1 overflow-y-auto px-6 py-4">
          {canManageMilestones && (
            <form
              className="mb-4 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!milestoneName.trim()) return;
                try {
                  await createMilestone.mutateAsync({ name: milestoneName });
                  setMilestoneName("");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not create milestone");
                }
              }}
            >
              <Input
                value={milestoneName}
                onChange={(e) => setMilestoneName(e.target.value)}
                placeholder="Add a milestone…"
              />
              <Button type="submit" disabled={createMilestone.isPending}>Add</Button>
            </form>
          )}
          <div className="flex flex-col gap-2">
            {milestones?.map((m) => (
              <div key={m.id} className="group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
                <label className="flex flex-1 items-center gap-3">
                  <Checkbox
                    checked={m.status === "completed"}
                    disabled={!canManageMilestones}
                    onCheckedChange={(checked) => void handleToggleMilestone(m.id, checked === true)}
                  />
                  <span className={m.status === "completed" ? "text-muted-foreground line-through" : ""}>
                    {m.name}
                  </span>
                </label>
                {canManageMilestones && (
                  <button
                    onClick={() => void handleDeleteMilestone(m.id)}
                    className="rounded-full p-0.5 text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                    title="Delete milestone"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
            {(!milestones || milestones.length === 0) && (
              <p className="text-sm text-muted-foreground">No milestones yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        defaultProjectId={projectId}
      />
    </div>
  );
}
