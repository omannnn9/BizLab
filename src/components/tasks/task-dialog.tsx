import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STATUS_LABELS } from "@/components/tasks/task-badges";
import { TaskComments } from "@/components/tasks/task-comments";
import { useCreateTask, useDeleteTask, useSetTaskAssignees, useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useCompanyMembers } from "@/hooks/use-members";
import type { Task, TaskPriority, TaskStatus } from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high", "urgent"];
const STATUSES: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultProjectId,
  defaultStatus,
  defaultTitle,
  defaultDescription,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task;
  defaultProjectId?: string;
  defaultStatus?: TaskStatus;
  defaultTitle?: string;
  defaultDescription?: string;
}) {
  const { data: projects } = useProjects();
  const { data: members } = useCompanyMembers();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const setAssignees = useSetTaskAssignees();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("none");
  const [dueDate, setDueDate] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? defaultTitle ?? "");
      setDescription(task?.description ?? defaultDescription ?? "");
      setProjectId(task?.project_id ?? defaultProjectId ?? "none");
      setStatus(task?.status ?? defaultStatus ?? "todo");
      setPriority(task?.priority ?? "none");
      setDueDate(task?.due_date ?? "");
      setAssigneeIds(task?.assignees?.map((a) => a.id) ?? []);
    }
  }, [open, task, defaultProjectId, defaultStatus, defaultTitle, defaultDescription]);

  const saving = createTask.isPending || updateTask.isPending || setAssignees.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const payload = {
      title,
      description: description || null,
      project_id: projectId === "none" ? null : projectId,
      status,
      priority,
      due_date: dueDate || null,
    };

    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...payload });
        const original = new Set(task.assignees?.map((a) => a.id) ?? []);
        const changed = original.size !== assigneeIds.length || assigneeIds.some((id) => !original.has(id));
        // Only touch task_assignees when the set actually changed — the
        // mutation deletes-then-reinserts every id, and a re-insert of
        // someone already assigned re-fires the "you were assigned"
        // notification trigger, which would otherwise re-notify the
        // whole list on every unrelated edit (title, status, due date…).
        if (changed) {
          await setAssignees.mutateAsync({ taskId: task.id, memberIds: assigneeIds });
        }
      } else {
        await createTask.mutateAsync({ ...payload, assigneeMemberIds: assigneeIds });
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project</SelectItem>
                  {projects?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {!task && (
            <div className="flex flex-col gap-1.5">
              <Label>Assignees</Label>
              <div className="flex flex-wrap gap-1.5">
                {members?.map((m) => {
                  const active = assigneeIds.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleAssignee(m.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
                        active ? "border-primary bg-primary/10 text-primary" : "hover:bg-accent"
                      )}
                    >
                      <Avatar className="size-4">
                        <AvatarFallback className="text-[9px]">
                          {(m.profile?.full_name ?? m.profile?.email ?? "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                      {m.profile?.full_name ?? m.profile?.email}
                      {active && <Check className="size-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {task && <TaskComments taskId={task.id} />}

          <DialogFooter className="sm:justify-between">
            {task && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  await deleteTask.mutateAsync(task.id);
                  onOpenChange(false);
                }}
              >
                Delete task
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {task ? "Save changes" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
