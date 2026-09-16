import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Trash2 } from "lucide-react";
import type { JSONContent } from "@tiptap/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/documents/rich-text-editor";
import { EntityLoadGuard } from "@/components/shared/entity-load-guard";
import { normalizeRichContent } from "@/lib/tiptap-content";
import { useDeleteKnowledgeArticle, useKnowledgeArticle, useUpdateKnowledgeArticle } from "@/hooks/use-knowledge";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/hooks/use-workspace";
import type { KnowledgeCategory } from "@/types/database";

const CATEGORIES: KnowledgeCategory[] = ["sop", "policy", "process", "training", "onboarding", "general"];

export function KnowledgeArticlePage() {
  const { articleId } = useParams<{ articleId: string }>();
  const { data: article, isLoading, isError } = useKnowledgeArticle(articleId);
  const updateArticle = useUpdateKnowledgeArticle();
  const deleteArticle = useDeleteKnowledgeArticle();
  const { company } = useWorkspace();
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  // Mirrors the "author or admins delete articles" RLS policy.
  const canDelete = !!article && (article.created_by === user?.id || can("knowledge_hub", "delete"));

  async function handleDelete() {
    if (!articleId) return;
    if (!window.confirm("Delete this article? This can't be undone.")) return;
    try {
      await deleteArticle.mutateAsync(articleId);
      navigate(`/w/${company?.slug}/knowledge`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete article");
    }
  }

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<JSONContent>({ type: "doc", content: [] });
  const [category, setCategory] = useState<KnowledgeCategory>("general");
  const [isPublished, setIsPublished] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (article && !initialized.current) {
      setTitle(article.title);
      setContent(normalizeRichContent(article.content));
      setCategory(article.category);
      setIsPublished(article.is_published);
      initialized.current = true;
    }
  }, [article]);

  useEffect(() => {
    if (!initialized.current || !articleId) return;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await updateArticle.mutateAsync({ id: articleId, title, content, category, is_published: isPublished });
      setStatus("saved");
    }, 700);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, category, isPublished]);

  if (isLoading || isError || !article) {
    return (
      <EntityLoadGuard
        isLoading={isLoading}
        isError={isError}
        backTo={`/w/${company?.slug}/knowledge`}
        backLabel="Back to Knowledge Hub"
        notFoundMessage="This article doesn't exist or you don't have access to it."
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${company?.slug}/knowledge`)}>
          <ArrowLeft /> Knowledge Hub
        </Button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Published</span>
            <Switch checked={isPublished} onCheckedChange={setIsPublished} />
          </div>
          <Select value={category} onValueChange={(v) => setCategory(v as KnowledgeCategory)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {status === "saving" && <Loader2 className="size-3 animate-spin" />}
            {status === "saved" && <Check className="size-3" />}
            {status !== "idle" && (status === "saving" ? "Saving…" : "Saved")}
          </span>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void handleDelete()}
              disabled={deleteArticle.isPending}
              title="Delete article"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-8 py-10">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="w-full border-none bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-6">
          <RichTextEditor content={content} onChange={setContent} />
        </div>
      </div>
    </div>
  );
}
