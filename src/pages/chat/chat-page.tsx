import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Hash, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { useChannels, useCreateChannel } from "@/hooks/use-channels";
import { useJoinChannel } from "@/hooks/use-join-channel";
import { useMessages, useSendMessage } from "@/hooks/use-messages";
import { usePresence } from "@/hooks/use-presence";
import { MessageItem } from "@/components/chat/message-item";
import type { ChatChannel } from "@/types/database";

function ChannelList({
  channels,
  activeChannelId,
  onSelect,
  newChannelName,
  setNewChannelName,
  addingChannel,
  setAddingChannel,
  onCreateChannel,
}: {
  channels: ChatChannel[] | undefined;
  activeChannelId: string | undefined;
  onSelect: (id: string) => void;
  newChannelName: string;
  setNewChannelName: (v: string) => void;
  addingChannel: boolean;
  setAddingChannel: (v: boolean) => void;
  onCreateChannel: (e: React.FormEvent) => void;
}) {
  return (
    <div className="p-3">
      <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Channels</p>
      <div className="flex flex-col gap-0.5">
        {channels?.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
              c.id === activeChannelId ? "bg-accent font-medium" : "hover:bg-accent"
            )}
          >
            <Hash className="size-3.5 text-muted-foreground" /> {c.name}
          </button>
        ))}
      </div>
      {addingChannel ? (
        <form className="mt-1 px-1" onSubmit={onCreateChannel}>
          <Input
            autoFocus
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            onBlur={() => !newChannelName && setAddingChannel(false)}
            placeholder="channel-name"
            className="h-8"
          />
        </form>
      ) : (
        <button
          onClick={() => setAddingChannel(true)}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        >
          <Plus className="size-3.5" /> Add channel
        </button>
      )}
    </div>
  );
}

export function ChatPage() {
  const { channelId } = useParams<{ channelId: string }>();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  const { data: channels } = useChannels();
  const createChannel = useCreateChannel();
  const [newChannelName, setNewChannelName] = useState("");
  const [addingChannel, setAddingChannel] = useState(false);

  const activeChannelId = channelId ?? channels?.[0]?.id;
  const { data: messages } = useMessages(activeChannelId);
  const sendMessage = useSendMessage(activeChannelId);
  const { onlineUserIds, typingUsers, setTyping } = usePresence(activeChannelId);
  const [body, setBody] = useState("");

  useJoinChannel(activeChannelId);

  useEffect(() => {
    if (!channelId && channels?.[0]) {
      navigate(`/w/${company?.slug}/chat/${channels[0].id}`, { replace: true });
    }
  }, [channelId, channels, company?.slug, navigate]);

  const activeChannel = channels?.find((c) => c.id === activeChannelId);

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    const channel = await createChannel.mutateAsync(newChannelName);
    setNewChannelName("");
    setAddingChannel(false);
    navigate(`/w/${company?.slug}/chat/${channel.id}`);
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !activeChannelId) return;
    await sendMessage.mutateAsync({ body });
    setBody("");
    setTyping(false);
  }

  const [channelSheetOpen, setChannelSheetOpen] = useState(false);
  const channelListProps = {
    channels,
    activeChannelId,
    newChannelName,
    setNewChannelName,
    addingChannel,
    setAddingChannel,
    onCreateChannel: handleCreateChannel,
  };

  return (
    <div className="flex h-full">
      <div className="hidden w-56 shrink-0 border-r md:block">
        <ChannelList
          {...channelListProps}
          onSelect={(id) => navigate(`/w/${company?.slug}/chat/${id}`)}
        />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <Sheet open={channelSheetOpen} onOpenChange={setChannelSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-2 md:hidden">
                <Hash className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-background text-foreground">
              <ChannelList
                {...channelListProps}
                onSelect={(id) => {
                  navigate(`/w/${company?.slug}/chat/${id}`);
                  setChannelSheetOpen(false);
                }}
              />
            </SheetContent>
          </Sheet>
          <Hash className="hidden size-4 text-muted-foreground md:block" />
          <span className="truncate font-medium">{activeChannel?.name ?? "Select a channel"}</span>
          {onlineUserIds.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" />
              {onlineUserIds.length} online
            </span>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages?.map((m) => (
            <MessageItem key={m.id} message={m} channelId={activeChannelId!} />
          ))}
          {(!messages || messages.length === 0) && (
            <p className="text-sm text-muted-foreground">No messages yet. Say hello 👋</p>
          )}
        </div>

        <div className="border-t px-4 pt-1.5">
          <div className="h-4 text-xs text-muted-foreground">
            {typingUsers.length > 0 &&
              `${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing…`}
          </div>
          <form onSubmit={handleSend} className="flex gap-2 pb-3">
            <Input
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setTyping(e.target.value.length > 0);
              }}
              placeholder={`Message #${activeChannel?.name ?? ""}`}
            />
            <Button type="submit" size="icon">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
