import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, FileText, Folder, FolderPlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useCreateFolder, useFolders } from "@/hooks/use-folders";
import { useCreateDocument, useDocuments, useTemplates } from "@/hooks/use-documents";
import { useWorkspace } from "@/hooks/use-workspace";
import { formatDistanceToNow } from "date-fns";
import type { Document } from "@/types/database";

export function DocumentsPage() {
  const { company } = useWorkspace();
  const navigate = useNavigate();
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);

  const { data: folders } = useFolders("documents");
  const { data: documents, isLoading } = useDocuments(folderId);
  const { data: templates } = useTemplates();
  const createFolder = useCreateFolder("documents");
  const createDocument = useCreateDocument();

  async function handleNewDocument(fromTemplate?: Document) {
    const doc = await createDocument.mutateAsync({ folderId, title: "Untitled", fromTemplate });
    navigate(`/w/${company?.slug}/documents/${doc.id}`);
  }

  return (
    <div className="flex h-full">
      <div className="hidden w-56 shrink-0 border-r p-3 md:block">
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
            <DropdownMenu>
              <div className="flex">
                <Button onClick={() => handleNewDocument()} className="rounded-r-none">
                  <Plus /> New document
                </Button>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-l-none border-l border-primary-foreground/20 px-2">
                    <ChevronDown className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </div>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>New from template</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {templates && templates.length > 0 ? (
                  templates.map((t) => (
                    <DropdownMenuItem key={t.id} onClick={() => handleNewDocument(t)}>
                      {t.title}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>No templates yet</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
        <div className="p-6">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : documents && documents.length > 0 ? (
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
            <EmptyState
              icon={FileText}
              title="No documents in this folder"
              description="Create a wiki page, SOP, or collaborative note to get started."
              action={
                <Button size="sm" onClick={() => handleNewDocument()}>
                  <Plus /> New document
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
