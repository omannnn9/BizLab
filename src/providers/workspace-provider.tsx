import { createContext, useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMyCompanies } from "@/hooks/use-companies";
import type { Company, CompanyMember } from "@/types/database";

interface WorkspaceContextValue {
  company: Company | null;
  membership: CompanyMember | null;
  loading: boolean;
  notFound: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const { data: companies, isLoading } = useMyCompanies();

  const value = useMemo<WorkspaceContextValue>(() => {
    const match = companies?.find((m) => m.company.slug === slug);
    return {
      company: match?.company ?? null,
      membership: match ?? null,
      loading: isLoading,
      notFound: !isLoading && !match,
    };
  }, [companies, isLoading, slug]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
