import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { ChatMessage } from "@/types/database";

export function useMessages(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", channelId];

  const query = useQuery({
    queryKey,
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*, author:profiles(*)")
        .eq("channel_id", channelId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessage[];
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        () => void queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return query;
}

export function useSendMessage(channelId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("chat_messages")
        .insert({ channel_id: channelId!, author_id: user!.id, body });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}
