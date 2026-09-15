import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { MessageItem } from "@/components/chat/message-item";
import { useSendMessage, type ChatMessageWithReactions } from "@/hooks/use-messages";

export function ThreadPanel({
  parentMessage,
  replies,
  channelId,
  channelName,
  open,
  onOpenChange,
}: {
  parentMessage: ChatMessageWithReactions | null;
  replies: ChatMessageWithReactions[];
  channelId: string;
  channelName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const sendMessage = useSendMessage(channelId);
  const [body, setBody] = useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !parentMessage) return;
    try {
      await sendMessage.mutateAsync({ body, parentMessageId: parentMessage.id });
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reply");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col bg-background p-0 text-foreground sm:max-w-md">
        {parentMessage && (
          <>
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Thread</p>
              <p className="text-xs text-muted-foreground">
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </p>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <MessageItem message={parentMessage} channelId={channelId} channelName={channelName} />
              {replies.length > 0 && <div className="border-t" />}
              {replies.map((reply) => (
                <MessageItem key={reply.id} message={reply} channelId={channelId} channelName={channelName} />
              ))}
            </div>
            <form onSubmit={handleSend} className="flex gap-2 border-t p-3">
              <Input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Reply in thread…"
                autoFocus
              />
              <Button type="submit" size="icon" disabled={sendMessage.isPending}>
                <Send className="size-4" />
              </Button>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
