import { NavLink } from "react-router-dom";
import {
  BookOpen,
  Building2,
  CheckSquare,
  Compass,
  FileText,
  FolderKanban,
  FolderOpen,
  Gauge,
  Home,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  PenTool,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";
import { useAuth } from "@/hooks/use-auth";

const PRIMARY_ITEMS = [
  { to: "", label: "Home", icon: Home, end: true },
  { to: "my-work", label: "My Work", icon: ListTodo },
  { to: "companies", label: "Companies", icon: Compass },
];

const WORK_ITEMS = [
  { to: "projects", label: "Projects", icon: FolderKanban },
  { to: "tasks", label: "Tasks", icon: CheckSquare },
  { to: "knowledge", label: "Knowledge", icon: BookOpen },
  { to: "documents", label: "Documents", icon: FileText },
];

const COLLAB_ITEMS = [
  { to: "chat", label: "Collaboration", icon: MessagesSquare },
  { to: "whiteboards", label: "Whiteboards", icon: PenTool },
  { to: "files", label: "Files", icon: FolderOpen },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/15 text-primary"
            : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground"
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  );
}

function NavGroup({ label, items }: { label?: string; items: typeof WORK_ITEMS }) {
  return (
    <div className="mb-1">
      {label && (
        <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
          {label}
        </p>
      )}
      {items.map((item) => (
        <NavItem key={item.label} to={item.to} label={item.label} icon={item.icon} />
      ))}
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { company } = useWorkspace();
  const { profile } = useAuth();

  return (
    <div className="flex h-full flex-col" onClick={onNavigate}>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <NavGroup items={PRIMARY_ITEMS} />
        <NavGroup label="Work" items={WORK_ITEMS} />
        <NavGroup label="Collaboration" items={COLLAB_ITEMS} />
        {profile?.is_platform_admin && (
          <div className="mb-1">
            <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              OD Holdings
            </p>
            <NavItem to="command-center" label="Command Center" icon={Gauge} />
          </div>
        )}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <NavLink
          to="dashboards"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground"
            )
          }
        >
          <LayoutDashboard className="size-4" />
          Dashboards
        </NavLink>
        <NavLink
          to="settings"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-sidebar-foreground/75 hover:bg-white/5 hover:text-sidebar-foreground"
            )
          }
        >
          <Settings className="size-4" />
          Workspace settings
        </NavLink>
        <NavLink
          to="/workspaces"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <Building2 className="size-4" />
          Switch workspace
        </NavLink>
        <p className="mt-2 truncate px-2.5 text-xs text-sidebar-foreground/40">{company?.name}</p>
      </div>
    </div>
  );
}

/** Persistent sidebar for desktop viewports. On smaller screens it's
 * replaced by MobileNav's slide-over drawer (same SidebarNav content),
 * triggered from the Topbar's hamburger button.
 *
 * bg-sidebar is deliberately fixed dark in BOTH themes (--ink-950 in
 * index.css) — brand chrome, not a content surface that should follow
 * light/dark. Matches the direction already explored for BizLab's
 * login/dashboard/admin screens. */
export function Sidebar() {
  return (
    <aside className="hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarNav />
    </aside>
  );
}
