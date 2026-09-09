import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

export function NotificationsPage() {
  const { data: notifications, isLoading, unreadCount, markRead, markAllRead } = useNotifications();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Notifications"
        description="Stay on top of everything happening in your workspace."
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? null : notifications && notifications.length > 0 ? (
          <div className="flex flex-col divide-y rounded-lg border">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  void markRead(n.id);
                  if (n.link) navigate(`/w/${company?.slug}${n.link}`);
                }}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 text-left hover:bg-accent/50",
                  !n.is_read && "bg-primary/5"
                )}
              >
                {!n.is_read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                <div className={cn("flex-1", n.is_read && "pl-3.5")}>
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">You're all caught up.</p>
        )}
      </div>
    </div>
  );
}
