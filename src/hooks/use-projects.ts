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
