import { NavLink, Outlet } from "react-router-dom";
import { PageHeader } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "general", label: "General" },
  { to: "members", label: "Members" },
  { to: "billing", label: "Billing" },
  { to: "security", label: "Security" },
];

export function SettingsLayout() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Workspace settings" description="Manage your company, team and subscription." />
      <div className="border-b px-6">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}
