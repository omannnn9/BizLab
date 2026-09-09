import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { ChatChannel } from "@/types/database";

export function useChannels() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["channels", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("company_id", company!.id)
        .eq("is_archived", false)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatChannel[];
    },
  });
}

export function useCreateChannel() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("chat_channels")
        .insert({ company_id: company!.id, name, type: "public", created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as ChatChannel;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["channels", company?.id] }),
  });
}
