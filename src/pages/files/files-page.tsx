import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  File as FileIcon,
  Folder as FolderIcon,
  FolderPlus,
  Image as ImageIcon,
  Lock,
  Share2,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBytes, cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ShareDialog } from "@/components/files/share-dialog";
import {
  useCreateFolder,
  useFolders,
  useFolderShares,
  useRevokeFolderShare,
  useShareFolder,
  useUpdateFolderVisibility,
} from "@/hooks/use-folders";
import {
  useDeleteFile,
  useFiles,
  useFileShares,
  useRevokeFileShare,
  useShareFile,
  useUpdateFileVisibility,
  useUploadFile,
  getFileDownloadUrl,
} from "@/hooks/use-files";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import type { FileObject, Folder } from "@/types/database";

function iconFor(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  if (mimeType?.startsWith("video/")) return Video;
  return FileIcon;
}

function FileAccessDialog({
  file,
  open,
  onOpenChange,
}: {
  file: FileObject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: shares, isLoading: sharesLoading } = useFileShares(file.id);
  const updateVisibility = useUpdateFileVisibility();
  const shareFile = useShareFile(file.id);
  const revokeShare = useRevokeFileShare(file.id);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    try {
      await revokeShare.mutateAsync(shareId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke access");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      itemName={file.name}
      itemKind="file"
      visibility={file.visibility}
      onUpdateVisibility={(v) => updateVisibility.mutate({ fileId: file.id, visibility: v })}
      updatingVisibility={updateVisibility.isPending}
      shares={shares ?? []}
      sharesLoading={sharesLoading}
      onShare={(email, accessLevel) => shareFile.mutateAsync({ email, accessLevel })}
      sharing={shareFile.isPending}
      onRevoke={(id) => void handleRevoke(id)}
      revokingId={revokingId}
    />
  );
}

function FolderAccessDialog({
  folder,
  open,
  onOpenChange,
}: {
  folder: Folder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: shares, isLoading: sharesLoading } = useFolderShares(folder.id);
  const updateVisibility = useUpdateFolderVisibility("files");
  const shareFolder = useShareFolder(folder.id);
  const revokeShare = useRevokeFolderShare(folder.id);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleRevoke(shareId: string) {
    setRevokingId(shareId);
    try {
      await revokeShare.mutateAsync(shareId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke access");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <ShareDialog
      open={open}
      onOpenChange={onOpenChange}
      itemName={folder.name}
      itemKind="folder"
      visibility={folder.visibility}
      onUpdateVisibility={(v) => updateVisibility.mutate({ folderId: folder.id, visibility: v })}
      updatingVisibility={updateVisibility.isPending}
      shares={shares ?? []}
      sharesLoading={sharesLoading}
      onShare={(email, accessLevel) => shareFolder.mutateAsync({ email, accessLevel })}
      sharing={shareFolder.isPending}
      onRevoke={(id) => void handleRevoke(id)}
      revokingId={revokingId}
    />
  );
}

export function FilesPage() {
  const [folderId, setFolderId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareFolderId, setShareFolderId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { company } = useWorkspace();
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();

  const { data: folders } = useFolders("files");
  const { data: files, isLoading } = useFiles(folderId);
  const createFolder = useCreateFolder("files");
  const uploadFile = useUploadFile(folderId);
  const deleteFile = useDeleteFile();

  // Looked up by id (not held as a snapshot) so the dialog reflects the
  // latest visibility/shares after a mutation invalidates these queries.
  const shareFileTarget = files?.find((f) => f.id === shareFileId) ?? null;
  const shareFolderTarget = folders?.find((f) => f.id === shareFolderId) ?? null;

  // Mirrors the "uploader or managers delete files" RLS policy — the
  // uploader can always delete their own upload; otherwise manager+.
  function canDeleteFile(file: FileObject) {
    return file.uploaded_by === user?.id || can("files", "delete");
  }

  // Who can restrict/share an item — uploader/creator, or manager+
  // (mirrors the file_shares/folder_shares insert RLS policies).
  function canManageFile(file: FileObject) {
    return file.uploaded_by === user?.id || can("files", "manage");
  }
  function canManageFolder(folder: Folder) {
    return folder.created_by === user?.id || can("files", "manage");
  }

  async function handleDelete(file: FileObject) {
    try {
      await deleteFile.mutateAsync(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete file");
    }
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      try {
        await uploadFile.mutateAsync(file);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
      }
    }
  }

  async function handleDownload(storagePath: string, name: string) {
    try {
      const url = await getFileDownloadUrl(storagePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate download link");
    }
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
          <FolderIcon className="size-4" /> All files
        </button>
        <div className="mt-1 flex flex-col gap-0.5">
          {folders?.map((f) => (
            <div key={f.id} className="group flex items-center">
              <button
                onClick={() => setFolderId(f.id)}
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  folderId === f.id ? "bg-accent font-medium" : "hover:bg-accent"
                )}
              >
                <FolderIcon className="size-4 shrink-0" />
                <span className="truncate">{f.name}</span>
                {f.visibility === "restricted" && <Lock className="size-3 shrink-0 text-muted-foreground" />}
              </button>
              {canManageFolder(f) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                  onClick={() => setShareFolderId(f.id)}
                >
                  <Share2 className="size-3.5" />
                </Button>
              )}
            </div>
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
          title="File Storage"
          description="Upload, organize and share files securely."
          actions={
            <Button onClick={() => inputRef.current?.click()}>
              <Upload /> Upload
            </Button>
          }
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />

        <div
          className="p-6"
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void handleFiles(e.dataTransfer.files);
          }}
        >
          <div
            className={cn(
              "mb-4 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
              dragActive ? "border-primary bg-primary/5" : "border-border"
            )}
          >
            <Upload className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag and drop files here, or click Upload</p>
          </div>

          {isLoading ? (
            <Skeleton className="h-40" />
          ) : files && files.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Size</th>
                    <th className="px-4 py-2 font-medium">Uploaded</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {files.map((file) => {
                    const Icon = iconFor(file.mime_type);
                    return (
                      <tr key={file.id} className="hover:bg-accent/50">
                        <td className="px-4 py-2.5 font-medium">
                          <button
                            onClick={() => navigate(`/w/${company?.slug}/files/${file.id}`)}
                            className="flex items-center gap-2 text-left hover:underline"
                          >
                            <Icon className="size-4 shrink-0 text-muted-foreground" />
                            {file.name}
                            {file.visibility === "restricted" && (
                              <Badge variant="outline" className="ml-1">
                                <Lock className="size-3" /> Restricted
                              </Badge>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{formatBytes(file.file_size)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(file.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex justify-end gap-1">
                            {canManageFile(file) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => setShareFileId(file.id)}
                              >
                                <Share2 className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => void handleDownload(file.storage_path, file.name)}
                            >
                              <Download className="size-3.5" />
                            </Button>
                            {canDeleteFile(file) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => void handleDelete(file)}
                                disabled={deleteFile.isPending}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={FileIcon}
              title="No files in this folder"
              description="Drag files onto this page or use Upload to add your first one."
              action={
                <Button size="sm" onClick={() => inputRef.current?.click()}>
                  <Upload /> Upload
                </Button>
              }
            />
          )}
        </div>
      </div>

      {shareFileTarget && (
        <FileAccessDialog
          file={shareFileTarget}
          open={!!shareFileTarget}
          onOpenChange={(open) => !open && setShareFileId(null)}
        />
      )}
      {shareFolderTarget && (
        <FolderAccessDialog
          folder={shareFolderTarget}
          open={!!shareFolderTarget}
          onOpenChange={(open) => !open && setShareFolderId(null)}
        />
      )}
    </div>
  );
}
