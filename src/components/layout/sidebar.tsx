import { NavLink } from "react-router-dom";
import {
  BookOpen,
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

const NAV_ITEMS = [
  { to: "", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "tasks", label: "Tasks", icon: CheckSquare },
  { to: "projects", label: "Projects", icon: FolderKanban },
  { to: "documents", label: "Documents", icon: FileText },
  { to: "files", label: "Files", icon: FolderOpen },
  { to: "chat", label: "Chat", icon: MessagesSquare },
  { to: "whiteboards", label: "Whiteboards", icon: PenTool },
  { to: "knowledge", label: "Knowledge Hub", icon: BookOpen },
];

export function Sidebar() {
  const { company } = useWorkspace();

  return (
    <aside className="flex h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/80 hover:bg-accent hover:text-accent-foreground"
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
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
        <p className="mt-2 truncate px-2.5 text-xs text-muted-foreground">{company?.name}</p>
      </div>
    </aside>
  );
}
