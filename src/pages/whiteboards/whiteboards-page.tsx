import { useNavigate } from "react-router-dom";
import { PenTool, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDistanceToNow } from "date-fns";
import { useCreateWhiteboard, useWhiteboards } from "@/hooks/use-whiteboards";
import { useWorkspace } from "@/hooks/use-workspace";

export function WhiteboardsPage() {
  const { data: whiteboards, isLoading } = useWhiteboards();
  const createWhiteboard = useCreateWhiteboard();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  async function handleCreate() {
    const board = await createWhiteboard.mutateAsync("Untitled board");
    navigate(`/w/${company?.slug}/whiteboards/${board.id}`);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Whiteboards"
        description="Infinite canvases for brainstorming and mapping ideas."
        actions={
          <Button onClick={handleCreate}>
            <Plus /> New board
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-video" />
            ))}
          </div>
        ) : whiteboards && whiteboards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whiteboards.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/w/${company?.slug}/whiteboards/${b.id}`)}
                className="flex aspect-video flex-col justify-between rounded-lg border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md"
              >
                <PenTool className="size-5 text-primary" />
                <div>
                  <p className="truncate text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(b.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={PenTool}
            title="No whiteboards yet"
            description="Spin up an infinite canvas to brainstorm or map out ideas with your team."
            action={
              <Button size="sm" onClick={handleCreate}>
                <Plus /> New board
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
