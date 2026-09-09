import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { WidgetRenderer } from "@/components/dashboard/widget-renderer";
import { useAddWidget, useDefaultDashboard, useRemoveWidget } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import type { WidgetType } from "@/types/database";

const AVAILABLE_WIDGETS: { type: WidgetType; label: string }[] = [
  { type: "task_completion", label: "Task completion" },
  { type: "my_tasks", label: "My tasks" },
  { type: "upcoming_deadlines", label: "Upcoming deadlines" },
  { type: "storage_usage", label: "Storage usage" },
  { type: "recent_activity", label: "Recent activity" },
  { type: "projects_overview", label: "Projects overview" },
  { type: "team_productivity", label: "Team productivity" },
];

export function DashboardPage() {
  const { data: dashboard, isLoading } = useDefaultDashboard();
  const { profile } = useAuth();
  const addWidget = useAddWidget(dashboard?.id);
  const removeWidget = useRemoveWidget();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}`}
        description="Here's what's happening across your workspace."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Plus /> Add widget
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {AVAILABLE_WIDGETS.map((w) => (
                <DropdownMenuItem key={w.type} onClick={() => addWidget.mutate(w.type)}>
                  {w.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard?.dashboard_widgets?.map((widget) => (
              <WidgetRenderer key={widget.id} widget={widget} onRemove={() => removeWidget.mutate(widget.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
