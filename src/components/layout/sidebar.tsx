import { NavLink } from "react-router-dom";
import {
  BookOpen,
  Briefcase,
  CheckSquare,
  DollarSign,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Lock,
  MessagesSquare,
  PenTool,
  Settings,
  FolderKanban,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useFeatureEnabled } from "@/hooks/use-billing";

const NAV_ITEMS: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; feature?: string }[] = [
  { to: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "tasks", label: "Tasks", icon: CheckSquare },
  { to: "projects", label: "Projects", icon: FolderKanban },
  { to: "documents", label: "Documents", icon: FileText },
  { to: "files", label: "Files", icon: FolderOpen },
  { to: "chat", label: "Chat", icon: MessagesSquare },
  { to: "whiteboards", label: "Whiteboards", icon: PenTool, feature: "whiteboards" },
  { to: "knowledge", label: "Knowledge Hub", icon: BookOpen, feature: "knowledge_hub" },
];

const BUSINESS_NAV_ITEMS = [
  { to: "crm", label: "CRM", icon: Briefcase, resource: "crm", feature: "crm" },
  { to: "hr", label: "HR", icon: Users, resource: "hr", feature: "hr" },
  { to: "finance", label: "Finance", icon: DollarSign, resource: "finance", feature: "finance" },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  locked,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <NavLink
        to="settings/billing"
        className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/40 hover:bg-accent/50"
        title={`${label} isn't included in your plan — upgrade to unlock`}
      >
        <Icon className="size-4" />
        {label}
        <Lock className="ml-auto size-3" />
      </NavLink>
    );
  }
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-sidebar-foreground/80 hover:bg-accent hover:text-accent-foreground"
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { company } = useWorkspace();
  const { can } = usePermissions();
  const whiteboardsEnabled = useFeatureEnabled("whiteboards");
  const knowledgeHubEnabled = useFeatureEnabled("knowledge_hub");
  const crmEnabled = useFeatureEnabled("crm");
  const hrEnabled = useFeatureEnabled("hr");
  const financeEnabled = useFeatureEnabled("finance");
  const featureFlags: Record<string, boolean> = {
    whiteboards: whiteboardsEnabled,
    knowledge_hub: knowledgeHubEnabled,
    crm: crmEnabled,
    hr: hrEnabled,
    finance: financeEnabled,
  };

  const visibleBusinessItems = BUSINESS_NAV_ITEMS.filter((item) => can(item.resource, "view"));

  return (
    <div className="flex h-full flex-col" onClick={onNavigate}>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.label}
            to={item.to}
            label={item.label}
            icon={item.icon}
            end={item.end}
            locked={!!item.feature && !featureFlags[item.feature]}
          />
        ))}

        {visibleBusinessItems.length > 0 && (
          <>
            <p className="mt-4 mb-1 px-2.5 text-xs font-medium text-muted-foreground">Business</p>
            {visibleBusinessItems.map((item) => (
              <NavItem
                key={item.label}
                to={item.to}
                label={item.label}
                icon={item.icon}
                locked={!featureFlags[item.feature]}
              />
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <NavLink
          to="settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-sidebar-foreground/80 hover:bg-accent hover:text-accent-foreground"
            )
          }
        >
          <Settings className="size-4" />
          Workspace settings
        </NavLink>
        <p className="mt-2 truncate px-2.5 text-xs text-muted-foreground">{company?.name}</p>
      </div>
    </div>
  );
}

/** Persistent sidebar for desktop viewports. On smaller screens it's
 * replaced by MobileNav's slide-over drawer (same SidebarNav content),
 * triggered from the Topbar's hamburger button. */
export function Sidebar() {
  return (
    <aside className="hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarNav />
    </aside>
  );
}
