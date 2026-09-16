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
    // ignoreDuplicates turns this into INSERT ... ON CONFLICT DO NOTHING.
    // Without it, revisiting an already-joined channel (every visit but
    // the first) hit the ON CONFLICT DO UPDATE path — and there's no
    // UPDATE policy on chat_channel_members, so RLS silently rejected
    // it every time. Harmless in effect (the row was already there) but
    // meant this fired a real, ignored error on every channel switch.
    void supabase
      .from("chat_channel_members")
      .upsert(
        { channel_id: channelId, member_id: membership.id },
        { onConflict: "channel_id,member_id", ignoreDuplicates: true }
      );
  }, [channelId, user, membership]);
}
