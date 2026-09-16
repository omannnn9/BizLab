import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Milestone, MilestoneStatus } from "@/types/database";

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: ["milestones", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("milestones")
        .select("*")
        .eq("project_id", projectId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Milestone[];
    },
  });
}

export function useCreateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; due_date?: string | null }) => {
      const { error } = await supabase.from("milestones").insert({ ...input, project_id: projectId });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });
}

export function useUpdateMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MilestoneStatus }) => {
      // RLS ("managers+ manage milestones") silently filters an
      // unauthorized UPDATE to zero rows instead of erroring, so the
      // checkbox would appear to toggle, then snap back on the next
      // refetch with no explanation — check the row actually changed.
      const { data, error } = await supabase.from("milestones").update({ status }).eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to update this milestone.");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });
}

export function useDeleteMilestone(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("milestones").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this milestone.");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["milestones", projectId] }),
  });
}
