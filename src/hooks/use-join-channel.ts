import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";

/** Ensures the current user has a chat_channel_members row before viewing a channel. */
export function useJoinChannel(channelId: string | undefined) {
  const { user } = useAuth();
  const { membership } = useWorkspace();

  useEffect(() => {
    if (!channelId || !user || !membership) return;
    void supabase
      .from("chat_channel_members")
      .upsert({ channel_id: channelId, member_id: membership.id }, { onConflict: "channel_id,member_id" });
  }, [channelId, user, membership]);
}
