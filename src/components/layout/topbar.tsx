import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { useWorkspace } from "@/hooks/use-workspace";

export function Topbar() {
  const { company } = useWorkspace();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`/w/${company?.slug}/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
      <WorkspaceSwitcher />
      <form onSubmit={handleSearch} className="mx-auto w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, docs, files, people…"
            className="pl-8"
          />
        </div>
      </form>
      <div className="flex items-center gap-2">
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
