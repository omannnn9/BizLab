import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useWorkspace } from "@/hooks/use-workspace";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";

export function WorkspaceLayout() {
  const { loading, notFound } = useWorkspace();
  useIdleTimeout();

  if (loading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return <Navigate to="/workspaces" replace />;
  }

  return (
    <div className="flex h-svh w-full overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
