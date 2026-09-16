import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUpdateWidgetConfig } from "@/hooks/use-dashboard";
import type { DashboardWidget } from "@/types/database";

interface QuickLink {
  id: string;
  title: string;
  url: string;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function QuickLinksWidget({
  widget,
  dashboardId,
  canEdit = true,
}: {
  widget: DashboardWidget;
  dashboardId?: string;
  canEdit?: boolean;
}) {
  const updateConfig = useUpdateWidgetConfig(dashboardId);
  const links = (widget.config.links as QuickLink[] | undefined) ?? [];
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  function saveLinks(next: QuickLink[]) {
    updateConfig.mutate({ widgetId: widget.id, config: { ...widget.config, links: next } });
  }

  function handleAdd() {
    if (!title.trim() || !url.trim()) return;
    saveLinks([...links, { id: crypto.randomUUID(), title: title.trim(), url: normalizeUrl(url) }]);
    setTitle("");
    setUrl("");
    setAdding(false);
  }

  function handleRemove(id: string) {
    saveLinks(links.filter((l) => l.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {links.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "Pin links to tools, docs, or sites your team uses often." : "No links pinned yet."}
        </p>
      )}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link) => (
            <div key={link.id} className="group relative">
              <Button variant="outline" size="sm" asChild>
                <a href={link.url} target="_blank" rel="noopener noreferrer" className={canEdit ? "pr-6" : undefined}>
                  <ExternalLink className="size-3.5" />
                  {link.title}
                </a>
              </Button>
              {canEdit && (
                <button
                  onClick={() => handleRemove(link.id)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground opacity-100 transition-opacity hover:bg-muted sm:opacity-0 sm:group-hover:opacity-100"
                  title="Remove link"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit &&
        (adding ? (
          <div className="mt-1 flex flex-col gap-2 rounded-md border p-2.5">
            <Input
              placeholder="Title (e.g. Figma)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
            />
            <Input
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!title.trim() || !url.trim()}>
                Add
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add link
          </Button>
        ))}
    </div>
  );
}
