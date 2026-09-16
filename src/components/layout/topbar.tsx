import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
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
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:gap-4 sm:px-4">
      <MobileNav />
      <WorkspaceSwitcher />
      <form onSubmit={handleSearch} className="mx-auto hidden w-full max-w-md sm:block">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, projects, files, people…"
            className="pl-8"
          />
        </div>
      </form>
      <Button
        variant="ghost"
        size="icon"
        className="ml-auto sm:hidden"
        onClick={() => navigate(`/w/${company?.slug}/search`)}
      >
        <Search className="size-4.5" />
        <span className="sr-only">Search</span>
      </Button>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
