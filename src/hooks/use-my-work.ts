import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";
import type { Project, Task } from "@/types/database";

export type MyWorkTask = Task & { project: Pick<Project, "id" | "name" | "color"> | null };

/** Everything "My Work" and the new Home page need, in two scoped
 * queries instead of pulling the whole company's task table and
 * filtering client-side (the bug useDashboardStats.myOpenTasks used to
 * have — see the fix there): tasks actually assigned to the viewer,
 * and open tasks the viewer created but delegated to someone else. */
export function useMyWorkTasks() {
  const { company, membership } = useWorkspace();

  return useQuery({
    queryKey: ["my-work-tasks", company?.id, membership?.id],
    enabled: !!company && !!membership,
    queryFn: async () => {
      const [assigned, delegated] = await Promise.all([
        supabase
          .from("task_assignees")
          .select("task:tasks(*, project:projects(id,name,color))")
          .eq("member_id", membership!.id),
        supabase
          .from("tasks")
          .select("*, project:projects(id,name,color)")
          .eq("company_id", company!.id)
          .eq("created_by", membership!.user_id)
          .neq("status", "done")
          .neq("status", "cancelled"),
      ]);
      if (assigned.error) throw assigned.error;
      if (delegated.error) throw delegated.error;

      const assignedToMe = ((assigned.data ?? []) as unknown as { task: MyWorkTask | null }[])
        .map((r) => r.task)
        .filter((t): t is MyWorkTask => !!t);
      const assignedIds = new Set(assignedToMe.map((t) => t.id));
      // "Waiting on others": tasks I created that aren't also assigned
      // back to me — otherwise every self-assigned task would show up
      // as both "waiting on me" and "waiting on others".
      const waitingOnOthers = ((delegated.data ?? []) as MyWorkTask[]).filter((t) => !assignedIds.has(t.id));

      return { assignedToMe, waitingOnOthers };
    },
  });
}
