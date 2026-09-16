import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import type { CompanyMember, Task, TaskPriority, TaskStatus } from "@/types/database";

interface RawTask extends Omit<Task, "assignees" | "project"> {
  project: { id: string; name: string; color: string } | null;
  task_assignees: { member: CompanyMember }[];
}

function normalize(row: RawTask): Task {
  const { task_assignees, ...rest } = row;
  return { ...rest, assignees: task_assignees?.map((a) => a.member) ?? [] };
}

// company_members has two FKs to profiles (user_id, invited_by) — without
// naming the constraint, PostgREST can't resolve "profile" and rejects the
// whole query. This was silent from the caller's point of view (no
// isError handling anywhere tasks are read), so every task list rendered
// as simply empty instead of surfacing a real fetch error.
const TASK_SELECT =
  "*, project:projects(id,name,color), task_assignees(member:company_members(*, profile:profiles!company_members_user_id_fkey(*)))";

export function useTasks(filters?: { projectId?: string }) {
  const { company } = useWorkspace();

  return useQuery({
    queryKey: ["tasks", company?.id, filters?.projectId ?? null],
    enabled: !!company,
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select(TASK_SELECT)
        .eq("company_id", company!.id)
        .is("parent_task_id", null)
        .order("position", { ascending: true });

      if (filters?.projectId) query = query.eq("project_id", filters.projectId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row) => normalize(row as unknown as RawTask));
    },
  });
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  project_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assigneeMemberIds?: string[];
}

export function useCreateTask() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { assigneeMemberIds, ...rest } = input;
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...rest, company_id: company!.id, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;

      if (assigneeMemberIds?.length) {
        await supabase
          .from("task_assignees")
          .insert(assigneeMemberIds.map((member_id) => ({ task_id: data.id, member_id })));
      }
      return data as Task;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", company?.id] }),
  });
}

export function useUpdateTask() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      if (patch.status === "done") patch.completed_at = new Date().toISOString();
      const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", company?.id] }),
  });
}

export function useDeleteTask() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // RLS silently filters an unauthorized DELETE to zero rows rather
      // than erroring — check the returned row so the caller can tell
      // "deleted" from "blocked" instead of showing a false success.
      const { data, error } = await supabase.from("tasks").delete().eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("You don't have permission to delete this task.");
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", company?.id] }),
  });
}

export function useSetTaskAssignees() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, memberIds }: { taskId: string; memberIds: string[] }) => {
      await supabase.from("task_assignees").delete().eq("task_id", taskId);
      if (memberIds.length) {
        await supabase
          .from("task_assignees")
          .insert(memberIds.map((member_id) => ({ task_id: taskId, member_id })));
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["tasks", company?.id] }),
  });
}
