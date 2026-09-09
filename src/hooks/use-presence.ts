import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

interface PresenceState {
  user_id: string;
  full_name: string;
  typing: boolean;
}

/** Realtime Presence for a chat channel: who's online, who's typing. */
export function usePresence(channelId: string | undefined) {
  const { user, profile } = useAuth();
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!channelId || !user) return;

    const channel = supabase.channel(`presence:${channelId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const entries = Object.values(state).flat();
        setOnlineUserIds(entries.map((e) => e.user_id));
        setTypingUsers(
          entries.filter((e) => e.typing && e.user_id !== user.id).map((e) => e.full_name || "Someone")
        );
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            full_name: profile?.full_name ?? profile?.email ?? "Someone",
            typing: false,
          } satisfies PresenceState);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, user?.id]);

  function setTyping(isTyping: boolean) {
    const channel = channelRef.current;
    if (!channel || !user) return;
    void channel.track({
      user_id: user.id,
      full_name: profile?.full_name ?? profile?.email ?? "Someone",
      typing: isTyping,
    } satisfies PresenceState);

    clearTimeout(typingTimeout.current);
    if (isTyping) {
      typingTimeout.current = setTimeout(() => setTyping(false), 4000);
    }
  }

  return { onlineUserIds, typingUsers, setTyping };
}
