import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { ChatMessage } from "@/types/database";

interface ChatReaction {
  id: string;
  message_id: string;
  member_id: string;
  emoji: string;
}

export interface ChatMessageWithReactions extends ChatMessage {
  chat_reactions: ChatReaction[];
}

export function useMessages(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ["messages", channelId];

  const query = useQuery({
    queryKey,
    enabled: !!channelId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*, author:profiles(*), chat_reactions(*)")
        .eq("channel_id", channelId!)
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ChatMessageWithReactions[];
    },
  });

  useEffect(() => {
    if (!channelId) return;
    const channel = supabase
      .channel(`chat:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `channel_id=eq.${channelId}` },
        () => void queryClient.invalidateQueries({ queryKey })
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_reactions" },
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
    mutationFn: async ({ body, parentMessageId }: { body: string; parentMessageId?: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .insert({ channel_id: channelId!, author_id: user!.id, body, parent_message_id: parentMessageId ?? null });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}

export function useEditMessage(channelId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ body, edited_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}

export function useDeleteMessage(channelId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"];

export function useToggleReaction(channelId: string | undefined) {
  const queryClient = useQueryClient();
  const { membership } = useWorkspace();

  return useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!membership) return;
      const { data: existing } = await supabase
        .from("chat_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("member_id", membership.id)
        .eq("emoji", emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from("chat_reactions").delete().eq("id", existing.id);
      } else {
        await supabase.from("chat_reactions").insert({ message_id: messageId, member_id: membership.id, emoji });
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["messages", channelId] }),
  });
}

export { QUICK_REACTIONS };
