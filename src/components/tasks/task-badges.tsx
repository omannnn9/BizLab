import { AlertTriangle, ArrowDown, ArrowUp, Equal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TaskPriority, TaskStatus } from "@/types/database";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  done: "Done",
  cancelled: "Cancelled",
};

export const KANBAN_COLUMNS: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];

export const PRIORITY_META: Record<TaskPriority, { label: string; icon: typeof ArrowUp; className: string }> = {
  none: { label: "No priority", icon: Equal, className: "text-muted-foreground" },
  low: { label: "Low", icon: ArrowDown, className: "text-muted-foreground" },
  medium: { label: "Medium", icon: Equal, className: "text-warning" },
  high: { label: "High", icon: ArrowUp, className: "text-orange-500" },
  urgent: { label: "Urgent", icon: AlertTriangle, className: "text-destructive" },
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  const variant = status === "done" ? "success" : status === "cancelled" ? "outline" : "secondary";
  return <Badge variant={variant}>{STATUS_LABELS[status]}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  );
}
