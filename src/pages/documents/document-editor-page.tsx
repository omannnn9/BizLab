import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, FileText, Loader2, MessageSquare, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import {
  useChildDocuments,
  useCreateDocument,
  useDocument,
  useSaveDocumentVersion,
  useUpdateDocument,
} from "@/hooks/use-documents";
import { useAddDocumentComment, useDocumentComments } from "@/hooks/use-document-comments";
import { useWorkspace } from "@/hooks/use-workspace";
import { RichTextEditor } from "@/components/documents/rich-text-editor";
import { VersionHistoryPanel } from "@/components/documents/version-history-panel";
import { ShareDialog } from "@/components/documents/share-dialog";
import { normalizeRichContent } from "@/lib/tiptap-content";
import type { JSONContent } from "@tiptap/react";

export function DocumentEditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { data: document, isLoading } = useDocument(documentId);
  const { data: parent } = useDocument(document?.parent_document_id ?? undefined);
  const { data: children } = useChildDocuments(documentId);
  const saveVersion = useSaveDocumentVersion(documentId);
  const updateDocument = useUpdateDocument();
  const createDocument = useCreateDocument();
  const { data: comments } = useDocumentComments(documentId);
  const addComment = useAddDocumentComment(documentId);
  const { company } = useWorkspace();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState<JSONContent>({ type: "doc", content: [] });
  const [panel, setPanel] = useState<"none" | "comments" | "history">("none");
  const [shareOpen, setShareOpen] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (document && !initialized.current) {
      setTitle(document.title);
      setContent(normalizeRichContent(document.content));
      initialized.current = true;
    }
  }, [document]);

  useEffect(() => {
    if (!initialized.current || !documentId) return;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await saveVersion.mutateAsync({ title, content });
      setStatus("saved");
    }, 800);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  if (isLoading || !document) return null;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div className="flex items-center gap-1 text-sm">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${company?.slug}/documents`)}>
              <ArrowLeft /> Documents
            </Button>
            {parent && (
              <>
                <ChevronRight className="size-3.5 text-muted-foreground" />
                <button
                  onClick={() => navigate(`/w/${company?.slug}/documents/${parent.id}`)}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {parent.title}
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {status === "saving" && (
              <span className="flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Saving…
              </span>
            )}
            {status === "saved" && (
              <span className="flex items-center gap-1">
                <Check className="size-3" /> Saved
              </span>
            )}
            <Button
              variant={document.is_template ? "default" : "outline"}
              size="sm"
              onClick={() => updateDocument.mutate({ id: document.id, is_template: !document.is_template })}
            >
              {document.is_template ? "Template" : "Save as template"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-3.5" /> Share
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPanel(panel === "history" ? "none" : "history")}
            >
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPanel(panel === "comments" ? "none" : "comments")}
            >
              <MessageSquare className="size-3.5" /> {comments?.length ?? 0}
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-8 py-10">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full border-none bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-6">
            <RichTextEditor content={content} onChange={setContent} />
          </div>

          <div className="mt-10 border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Sub-pages</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const child = await createDocument.mutateAsync({ parentDocumentId: documentId, title: "Untitled" });
                  navigate(`/w/${company?.slug}/documents/${child.id}`);
                }}
              >
                <Plus className="size-3.5" /> New sub-page
              </Button>
            </div>
            {children && children.length > 0 ? (
              <div className="flex flex-col gap-1">
                {children.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/w/${company?.slug}/documents/${c.id}`)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <FileText className="size-3.5 text-muted-foreground" /> {c.title}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No sub-pages yet.</p>
            )}
          </div>
        </div>
      </div>

      {panel === "history" && <VersionHistoryPanel documentId={documentId!} />}

      {panel === "comments" && (
        <div className="flex w-80 shrink-0 flex-col border-l">
          <div className="border-b px-4 py-3 text-sm font-medium">Comments</div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {comments?.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="size-6 shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {(c.author?.full_name ?? c.author?.email ?? "?")[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-medium">{c.author?.full_name ?? c.author?.email}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm">{c.body}</p>
                </div>
              </div>
            ))}
            {(!comments || comments.length === 0) && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
          </div>
          <form
            className="flex gap-2 border-t p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!commentBody.trim()) return;
              await addComment.mutateAsync(commentBody);
              setCommentBody("");
            }}
          >
            <Input
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Add a comment…"
              className="h-8"
            />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </div>
      )}

      <ShareDialog document={document} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
