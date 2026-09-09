import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Folder, FolderPlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useCreateFolder, useFolders } from "@/hooks/use-folders";
import { useCreateDocument, useDocuments } from "@/hooks/use-documents";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatDistanceToNow } from "date-fns";

export function DocumentsPage() {
  const { company } = useWorkspace();
  const navigate = useNavigate();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);

  const { data: folders } = useFolders("documents");
  const { data: documents, isLoading } = useDocuments(folderId);
  const createFolder = useCreateFolder("documents");
  const createDocument = useCreateDocument();

  async function handleNewDocument() {
    const doc = await createDocument.mutateAsync({ folderId, title: "Untitled" });
    navigate(`/w/${company?.slug}/documents/${doc.id}`);
  }

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r p-3">
        <button
          onClick={() => setFolderId(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            folderId === null ? "bg-accent font-medium" : "hover:bg-accent"
          )}
        >
          <FileText className="size-4" /> All documents
        </button>
        <p className="mt-3 px-2 text-xs font-medium text-muted-foreground">Folders</p>
        <div className="mt-1 flex flex-col gap-0.5">
          {folders?.map((f) => (
            <button
              key={f.id}
              onClick={() => setFolderId(f.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                folderId === f.id ? "bg-accent font-medium" : "hover:bg-accent"
              )}
            >
              <Folder className="size-4" /> {f.name}
            </button>
          ))}
        </div>
        {addingFolder ? (
          <form
            className="mt-1 px-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newFolderName.trim()) return;
              await createFolder.mutateAsync({ name: newFolderName });
              setNewFolderName("");
              setAddingFolder(false);
            }}
          >
            <Input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => !newFolderName && setAddingFolder(false)}
              placeholder="Folder name"
              className="h-8"
            />
          </form>
        ) : (
          <button
            onClick={() => setAddingFolder(true)}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
          >
            <FolderPlus className="size-4" /> New folder
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <PageHeader
          title="Documents"
          description="Wikis, SOPs and collaborative notes."
          actions={
            <Button onClick={handleNewDocument}>
              <Plus /> New document
            </Button>
          }
        />
        <div className="p-6">
          {isLoading ? null : documents && documents.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => navigate(`/w/${company?.slug}/documents/${doc.id}`)}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <FileText className="size-5 text-primary" />
                  <p className="truncate text-sm font-medium">{doc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No documents in this folder yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
