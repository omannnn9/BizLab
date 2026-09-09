import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Notification } from "@/types/database";

export function useNotifications() {
  const { user } = useAuth();
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  const queryKey = ["notifications", company?.id, user?.id];

  const query = useQuery({
    queryKey,
    enabled: !!user && !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*, actor:profiles!notifications_actor_id_fkey(*)")
        .eq("company_id", company!.id)
        .eq("recipient_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as unknown as Notification[];
    },
  });

  useEffect(() => {
    if (!user || !company) return;
    const channel = supabase
      .channel(`notifications:${company.id}:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        () => void queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, company?.id]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", id);
    void queryClient.invalidateQueries({ queryKey });
  }

  async function markAllRead() {
    if (!user || !company) return;
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("company_id", company.id)
      .eq("recipient_id", user.id)
      .eq("is_read", false);
    void queryClient.invalidateQueries({ queryKey });
  }

  const unreadCount = query.data?.filter((n) => !n.is_read).length ?? 0;

  return { ...query, unreadCount, markRead, markAllRead };
}
