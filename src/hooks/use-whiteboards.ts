import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Whiteboard } from "@/types/database";

export function useWhiteboards() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["whiteboards", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whiteboards")
        .select("*")
        .eq("company_id", company!.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Whiteboard[];
    },
  });
}

export function useWhiteboard(id: string | undefined) {
  return useQuery({
    queryKey: ["whiteboard", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("whiteboards").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Whiteboard;
    },
  });
}

export function useCreateWhiteboard() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("whiteboards")
        .insert({ company_id: company!.id, name, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Whiteboard;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["whiteboards", company?.id] }),
  });
}

export function useSaveWhiteboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, canvas_data }: { id: string; canvas_data: Whiteboard["canvas_data"] }) => {
      const { error } = await supabase
        .from("whiteboards")
        .update({ canvas_data, updated_by: user!.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, variables) => void queryClient.invalidateQueries({ queryKey: ["whiteboard", variables.id] }),
  });
}
