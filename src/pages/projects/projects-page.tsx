import { useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectDialog } from "@/components/projects/project-dialog";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspace } from "@/hooks/use-workspace";

const STATUS_LABELS: Record<string, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  archived: "Archived",
};

export function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const { company } = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Projects"
        description="Group work into milestones and track progress."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> New project
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} to={`/w/${company?.slug}/projects/${p.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="size-3 rounded-full" style={{ backgroundColor: p.color }} />
                      <Badge variant="outline">{STATUS_LABELS[p.status]}</Badge>
                    </div>
                    <h3 className="font-semibold">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                    )}
                    {p.due_date && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Due {new Date(p.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Group related tasks into a project to track progress and milestones together."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus /> Create your first project
              </Button>
            }
          />
        )}
      </div>

      <ProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
