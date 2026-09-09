import { formatDistanceToNow } from "date-fns";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDocumentVersions, useRestoreDocumentVersion } from "@/hooks/use-documents";

export function VersionHistoryPanel({ documentId }: { documentId: string }) {
  const { data: versions } = useDocumentVersions(documentId);
  const restore = useRestoreDocumentVersion(documentId);

  return (
    <div className="flex w-72 shrink-0 flex-col border-l">
      <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium">
        <History className="size-4" /> Version history
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!versions || versions.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {versions.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    v{v.version_number} {i === 0 && <span className="text-xs text-muted-foreground">(current)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.author?.full_name ?? v.author?.email} ·{" "}
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </p>
                </div>
                {i !== 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(v.version_number)}
                    title="Restore this version"
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
