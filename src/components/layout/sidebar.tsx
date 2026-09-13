import { NavLink } from "react-router-dom";
import {
  BookOpen,
  Building2,
  CheckSquare,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MessagesSquare,
  PenTool,
  Settings,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/use-workspace";

const NAV_ITEMS: { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }[] = [
  { to: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "tasks", label: "Tasks", icon: CheckSquare },
  { to: "projects", label: "Projects", icon: FolderKanban },
  { to: "documents", label: "Documents", icon: FileText },
  { to: "files", label: "Files", icon: FolderOpen },
  { to: "chat", label: "Chat", icon: MessagesSquare },
  { to: "whiteboards", label: "Whiteboards", icon: PenTool },
  { to: "knowledge", label: "Knowledge Hub", icon: BookOpen },
];

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
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

  return (
    <div className="flex h-full flex-col" onClick={onNavigate}>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavItem key={item.label} to={item.to} label={item.label} icon={item.icon} end={item.end} />
        ))}
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
        <NavLink
          to="/workspaces"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Building2 className="size-4" />
          Switch workspace
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
