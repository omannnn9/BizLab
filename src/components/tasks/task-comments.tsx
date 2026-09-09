import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddTaskComment, useTaskComments } from "@/hooks/use-task-comments";

export function TaskComments({ taskId }: { taskId: string }) {
  const { data: comments } = useTaskComments(taskId);
  const addComment = useAddTaskComment(taskId);
  const [body, setBody] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await addComment.mutateAsync(body);
    setBody("");
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Comments</p>
      <div className="flex max-h-40 flex-col gap-3 overflow-y-auto">
        {comments?.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar className="size-6 shrink-0">
              <AvatarFallback className="text-[10px]">
                {(c.author?.full_name ?? c.author?.email ?? "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium">{c.author?.full_name ?? c.author?.email}</span>
                <span className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="text-sm">{c.body}</p>
            </div>
          </div>
        ))}
        {(!comments || comments.length === 0) && (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          className="h-8"
        />
        <Button type="submit" size="icon" className="size-8" disabled={addComment.isPending}>
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
