import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { File as FileIcon, MessageSquare, Pencil, SmilePlus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatBytes } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  QUICK_REACTIONS,
  getAttachmentDownloadUrl,
  useDeleteMessage,
  useEditMessage,
  useToggleReaction,
  type ChatMessageWithReactions,
} from "@/hooks/use-messages";

function AttachmentChip({ attachment }: { attachment: ChatMessageWithReactions["attachments"][number] }) {
  const [opening, setOpening] = useState(false);

  async function handleOpen() {
    setOpening(true);
    try {
      const url = await getAttachmentDownloadUrl(attachment.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  return (
    <button
      onClick={handleOpen}
      disabled={opening}
      className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-60"
    >
      <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 text-muted-foreground">{formatBytes(attachment.size)}</span>
    </button>
  );
}

export function MessageItem({
  message,
  channelId,
  replyCount,
  onOpenThread,
}: {
  message: ChatMessageWithReactions;
  channelId: string;
  replyCount?: number;
  onOpenThread?: () => void;
}) {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const editMessage = useEditMessage(channelId);
  const deleteMessage = useDeleteMessage(channelId);
  const toggleReaction = useToggleReaction(channelId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.body ?? "");

  const isOwn = message.author_id === user?.id;
  const isDeleted = !!message.deleted_at;

  const reactionGroups = (message.chat_reactions ?? []).reduce<Record<string, string[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r.member_id);
    return acc;
  }, {});

  async function handleSaveEdit() {
    if (!draft.trim()) return;
    await editMessage.mutateAsync({ id: message.id, body: draft });
    setEditing(false);
  }

  return (
    <div className="group flex gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="text-xs">
          {(message.author?.full_name ?? message.author?.email ?? "?")[0]}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{message.author?.full_name ?? message.author?.email}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
          </span>
          {message.edited_at && !isDeleted && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>

        {isDeleted ? (
          <p className="text-sm italic text-muted-foreground">This message was deleted</p>
        ) : editing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-16" autoFocus />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} disabled={editMessage.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {message.body && <p className="whitespace-pre-wrap text-sm">{message.body}</p>}
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-1.5 flex flex-col gap-1">
                {message.attachments.map((att) => (
                  <AttachmentChip key={att.storage_path} attachment={att} />
                ))}
              </div>
            )}
          </>
        )}

        {!isDeleted && Object.keys(reactionGroups).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(reactionGroups).map(([emoji, memberIds]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction.mutate({ messageId: message.id, emoji })}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                  membership && memberIds.includes(membership.id) ? "border-primary bg-primary/10" : "hover:bg-accent"
                )}
              >
                {emoji} {memberIds.length}
              </button>
            ))}
          </div>
        )}

        {!isDeleted && onOpenThread && !!replyCount && (
          <button
            onClick={onOpenThread}
            className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <MessageSquare className="size-3.5" />
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {!isDeleted && (
        <div className="flex h-fit items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onOpenThread && (
            <Button variant="ghost" size="icon" className="size-7" onClick={onOpenThread} title="Reply in thread">
              <MessageSquare className="size-3.5" />
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7">
                <SmilePlus className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-1.5">
              <div className="flex gap-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction.mutate({ messageId: message.id, emoji })}
                    className="rounded p-1 text-base hover:bg-accent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          {isOwn && (
            <>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(true)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => deleteMessage.mutate(message.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
