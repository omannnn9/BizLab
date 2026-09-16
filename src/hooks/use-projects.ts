import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Project, ProjectStatus } from "@/types/database";

export function useProjects() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["projects", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", company!.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
  });
}

/** Task completion counts per project, in one grouped query rather than
 * N+1 — used by the projects list to show real progress on each card. */
export function useProjectTaskCounts() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["project-task-counts", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("project_id, status")
        .eq("company_id", company!.id)
        .not("project_id", "is", null);
      if (error) throw error;

      const counts = new Map<string, { done: number; total: number }>();
      for (const row of data ?? []) {
        const projectId = row.project_id as string;
        const entry = counts.get(projectId) ?? { done: 0, total: 0 };
        entry.total += 1;
        if (row.status === "done") entry.done += 1;
        counts.set(projectId, entry);
      }
      return counts;
    },
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId!).single();
      if (error) throw error;
      return data as Project;
    },
  });
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
  start_date?: string | null;
  due_date?: string | null;
}

export function useCreateProject() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ ...input, company_id: company!.id, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["projects", company?.id] }),
  });
}

export function useDeleteProject() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("projects").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this project.");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["projects", company?.id] }),
  });
}

export function useUpdateProject() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase.from("projects").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["projects", company?.id] });
      void queryClient.invalidateQueries({ queryKey: ["project", data.id] });
    },
  });
}
