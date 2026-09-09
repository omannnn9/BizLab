import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useDocument, useUpdateDocument } from "@/hooks/use-documents";
import { useAddDocumentComment, useDocumentComments } from "@/hooks/use-document-comments";
import { useWorkspace } from "@/hooks/use-workspace";

export function DocumentEditorPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const { data: document, isLoading } = useDocument(documentId);
  const updateDocument = useUpdateDocument();
  const { data: comments } = useDocumentComments(documentId);
  const addComment = useAddDocumentComment(documentId);
  const { company } = useWorkspace();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (document && !initialized.current) {
      setTitle(document.title);
      setText((document.content as { text?: string })?.text ?? "");
      initialized.current = true;
    }
  }, [document]);

  useEffect(() => {
    if (!initialized.current || !documentId) return;
    setStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await updateDocument.mutateAsync({ id: documentId, title, content: { text } });
      setStatus("saved");
    }, 700);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, text]);

  if (isLoading || !document) return null;

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${company?.slug}/documents`)}>
            <ArrowLeft /> Documents
          </Button>
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
            <Button variant="outline" size="sm" onClick={() => setShowComments((v) => !v)}>
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
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Start writing…"
            className="mt-6 min-h-[60vh] resize-none border-none px-0 text-base shadow-none focus-visible:ring-0"
          />
        </div>
      </div>

      {showComments && (
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
    </div>
  );
}
