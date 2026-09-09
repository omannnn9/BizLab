import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { useCreateKnowledgeArticle, useKnowledgeArticles } from "@/hooks/use-knowledge";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/hooks/use-workspace";
import type { KnowledgeCategory } from "@/types/database";

const CATEGORIES: { value: KnowledgeCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sop", label: "SOPs" },
  { value: "policy", label: "Policies" },
  { value: "process", label: "Processes" },
  { value: "training", label: "Training" },
  { value: "onboarding", label: "Onboarding" },
  { value: "general", label: "General" },
];

export function KnowledgePage() {
  const [category, setCategory] = useState<KnowledgeCategory | "all">("all");
  const { data: articles, isLoading } = useKnowledgeArticles(category === "all" ? undefined : category);
  const createArticle = useCreateKnowledgeArticle();
  const { can } = usePermissions();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  async function handleCreate() {
    const article = await createArticle.mutateAsync({
      title: "Untitled article",
      category: category === "all" ? "general" : category,
    });
    navigate(`/w/${company?.slug}/knowledge/${article.id}`);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Knowledge Hub"
        description="Your company's SOPs, policies and onboarding guides."
        actions={
          can("knowledge_hub", "create") ? (
            <Button onClick={handleCreate}>
              <Plus /> New article
            </Button>
          ) : undefined
        }
      />
      <div className="border-b px-6 py-3">
        <Tabs value={category} onValueChange={(v) => setCategory(v as KnowledgeCategory | "all")}>
          <TabsList>
            {CATEGORIES.map((c) => (
              <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? null : articles && articles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/w/${company?.slug}/knowledge/${a.id}`)}
                className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <BookOpen className="size-5 text-primary" />
                  {!a.is_published && <Badge variant="outline">Draft</Badge>}
                </div>
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="text-xs text-muted-foreground">
                  Updated {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No articles yet.</p>
        )}
      </div>
    </div>
  );
}
