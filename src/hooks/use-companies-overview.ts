import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAllCompanies, type AdminCompany } from "@/hooks/use-admin";

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  role: string;
  activeProjects: number;
  openTasks: number;
}

/** One grouped query per entity across every company the viewer
 * belongs to, instead of N+1 per-company requests — the Companies hub
 * shows real counts, not just names. */
export function useCompanySummaries() {
  const { data: memberships, isLoading: loadingMemberships } = useMyCompanies();

  const companyIds = (memberships ?? []).map((m) => m.company_id);

  const query = useQuery({
    queryKey: ["company-summaries", companyIds.slice().sort().join(",")],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const [projects, tasks] = await Promise.all([
        supabase.from("projects").select("company_id").in("company_id", companyIds).eq("is_archived", false),
        supabase
          .from("tasks")
          .select("company_id")
          .in("company_id", companyIds)
          .neq("status", "done")
          .neq("status", "cancelled"),
      ]);
      if (projects.error) throw projects.error;
      if (tasks.error) throw tasks.error;

      const projectCounts = new Map<string, number>();
      for (const p of projects.data ?? []) projectCounts.set(p.company_id, (projectCounts.get(p.company_id) ?? 0) + 1);
      const taskCounts = new Map<string, number>();
      for (const t of tasks.data ?? []) taskCounts.set(t.company_id, (taskCounts.get(t.company_id) ?? 0) + 1);

      return { projectCounts, taskCounts };
    },
  });

  const summaries: CompanySummary[] = (memberships ?? []).map((m) => ({
    id: m.company.id,
    name: m.company.name,
    slug: m.company.slug,
    industry: m.company.industry,
    role: m.role,
    activeProjects: query.data?.projectCounts.get(m.company_id) ?? 0,
    openTasks: query.data?.taskCounts.get(m.company_id) ?? 0,
  }));

  return { summaries, isLoading: loadingMemberships || query.isLoading };
}

export interface CompanyHealth extends AdminCompany {
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
  completionRate: number;
}

export interface CriticalDeadline {
  id: string;
  title: string;
  due_date: string;
  companyName: string;
  companySlug: string;
}

/** Platform-wide rollup for the Command Center — every number here
 * comes from a real query grouped client-side; nothing here is a
 * placeholder metric. Things the request asked for that have no
 * backing entity yet (strategic initiatives, risks, open decisions)
 * are deliberately not faked here — see the roadmap note on that. */
export function useCommandCenterData() {
  const { data: companies, isLoading: loadingCompanies } = useAllCompanies();
  const companyIds = (companies ?? []).map((c) => c.id);

  const query = useQuery({
    queryKey: ["command-center", companyIds.slice().sort().join(",")],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const [projects, tasks] = await Promise.all([
        supabase.from("projects").select("id,company_id").in("company_id", companyIds).eq("is_archived", false),
        supabase
          .from("tasks")
          .select("id,title,status,due_date,company_id")
          .in("company_id", companyIds),
      ]);
      if (projects.error) throw projects.error;
      if (tasks.error) throw tasks.error;
      return { projects: projects.data ?? [], tasks: tasks.data ?? [] };
    },
  });

  const today = new Date().setHours(0, 0, 0, 0);
  const companyById = new Map((companies ?? []).map((c) => [c.id, c]));

  const health: CompanyHealth[] = (companies ?? []).map((c) => {
    const companyTasks = (query.data?.tasks ?? []).filter((t) => t.company_id === c.id);
    const done = companyTasks.filter((t) => t.status === "done").length;
    const open = companyTasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length;
    const overdue = companyTasks.filter(
      (t) => t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date).setHours(0, 0, 0, 0) < today
    ).length;
    return {
      ...c,
      activeProjects: (query.data?.projects ?? []).filter((p) => p.company_id === c.id).length,
      openTasks: open,
      overdueTasks: overdue,
      completionRate: companyTasks.length > 0 ? Math.round((done / companyTasks.length) * 100) : 0,
    };
  });

  const criticalDeadlines: CriticalDeadline[] = (query.data?.tasks ?? [])
    .filter((t) => t.status !== "done" && t.status !== "cancelled" && t.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date!,
      companyName: companyById.get(t.company_id)?.name ?? "Unknown",
      companySlug: companyById.get(t.company_id)?.slug ?? "",
    }));

  const totals = {
    companies: companies?.length ?? 0,
    members: (companies ?? []).reduce((sum, c) => sum + c.member_count, 0),
    activeProjects: query.data?.projects.length ?? 0,
    openTasks: (query.data?.tasks ?? []).filter((t) => t.status !== "done" && t.status !== "cancelled").length,
    overdueTasks: health.reduce((sum, c) => sum + c.overdueTasks, 0),
  };

  return { health, criticalDeadlines, totals, isLoading: loadingCompanies || query.isLoading };
}
