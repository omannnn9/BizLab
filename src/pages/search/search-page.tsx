import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CheckSquare,
  FileText,
  FolderKanban,
  FolderOpen,
  Loader2,
  MessagesSquare,
  Search as SearchIcon,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";
import type { GlobalSearchResult } from "@/types/database";

const TYPE_META: Record<GlobalSearchResult["result_type"], { icon: typeof SearchIcon; label: string }> = {
  task: { icon: CheckSquare, label: "Task" },
  project: { icon: FolderKanban, label: "Project" },
  document: { icon: FileText, label: "Document" },
  file: { icon: FolderOpen, label: "File" },
  chat_message: { icon: MessagesSquare, label: "Message" },
  knowledge_article: { icon: BookOpen, label: "Knowledge" },
  user: { icon: User, label: "Person" },
};

function routeFor(result: GlobalSearchResult, slug: string) {
  switch (result.result_type) {
    case "task":
      return `/w/${slug}/tasks`;
    case "project":
      return `/w/${slug}/projects/${result.id}`;
    case "document":
      return `/w/${slug}/documents/${result.id}`;
    case "file":
      return `/w/${slug}/files`;
    case "chat_message":
      return result.url_path.replace("/chat/", `/w/${slug}/chat/`);
    case "knowledge_article":
      return `/w/${slug}/knowledge/${result.id}`;
    case "user":
      return `/w/${slug}/settings/members`;
  }
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { company } = useWorkspace();
  const navigate = useNavigate();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => setQuery(searchParams.get("q") ?? ""), [searchParams]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["global-search", company?.id, searchParams.get("q")],
    enabled: !!company && !!searchParams.get("q"),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("global_search", {
        p_company_id: company!.id,
        p_query: searchParams.get("q")!,
        p_limit: 40,
      });
      if (error) throw error;
      return (data ?? []) as GlobalSearchResult[];
    },
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Search" description="Find anything across your workspace." />
      <div className="border-b px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchParams(query ? { q: query } : {});
          }}
        >
          <div className="relative max-w-lg">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks, projects, documents, files, chat, people…"
              className="pl-9"
            />
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {isFetching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Searching…
          </div>
        )}
        {!isFetching && searchParams.get("q") && (!results || results.length === 0) && (
          <p className="text-sm text-muted-foreground">No results for "{searchParams.get("q")}".</p>
        )}
        <div className="flex flex-col gap-2">
          {results?.map((r) => {
            const meta = TYPE_META[r.result_type];
            const Icon = meta.icon;
            return (
              <button
                key={`${r.result_type}-${r.id}`}
                onClick={() => company && navigate(routeFor(r, company.slug))}
                className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-left hover:bg-accent/50"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  {r.snippet && <p className="truncate text-xs text-muted-foreground">{r.snippet}</p>}
                </div>
                <Badge variant="outline">{meta.label}</Badge>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
