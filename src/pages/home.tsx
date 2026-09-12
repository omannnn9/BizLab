import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { WorkspacePicker } from "@/pages/onboarding/workspace-picker";

/**
 * BizLab is an internal-only platform: there is no marketing site.
 * `/` either sends a visitor to the login page or drops a signed-in
 * user straight into their workspace (WorkspacePicker itself decides
 * between "auto-redirect into the one company you have" and "show a
 * switcher" once there's more than one).
 */
export function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <WorkspacePicker />;
}
