import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, isToday, isWeekend, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/database";

type Zoom = "week" | "month";
const ZOOM_DAYS: Record<Zoom, number> = { week: 14, month: 30 };
const DAY_WIDTH: Record<Zoom, number> = { week: 64, month: 32 };

interface TimelineTask extends Task {
  barStart: Date;
  barEnd: Date;
}

export function TaskTimelineView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (task: Task) => void }) {
  const [zoom, setZoom] = useState<Zoom>("week");
  const [viewStart, setViewStart] = useState(() => startOfDay(new Date()));

  const dayCount = ZOOM_DAYS[zoom];
  const dayWidth = DAY_WIDTH[zoom];
  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, i) => addDays(viewStart, i)),
    [viewStart, dayCount]
  );
  const viewEnd = days[days.length - 1];

  const timelineTasks: TimelineTask[] = tasks
    .filter((t) => t.due_date)
    .map((t) => {
      const end = startOfDay(new Date(t.due_date!));
      const start = t.start_date ? startOfDay(new Date(t.start_date)) : end;
      return { ...t, barStart: start > end ? end : start, barEnd: end };
    })
    .filter((t) => t.barEnd >= viewStart && t.barStart <= viewEnd);

  const groups = new Map<string, { name: string; color: string; tasks: TimelineTask[] }>();
  for (const t of timelineTasks) {
    const key = t.project?.id ?? "none";
    if (!groups.has(key)) {
      groups.set(key, { name: t.project?.name ?? "No project", color: t.project?.color ?? "#94a3b8", tasks: [] });
    }
    groups.get(key)!.tasks.push(t);
  }

  function barStyle(t: TimelineTask) {
    // +2, not +1: grid column 1 is the 180px label column, so day 0
    // (startOffset === 0) lands on grid column 2.
    const startOffset = Math.max(0, differenceInCalendarDays(t.barStart, viewStart));
    const endOffset = Math.min(dayCount - 1, differenceInCalendarDays(t.barEnd, viewStart));
    const span = Math.max(1, endOffset - startOffset + 1);
    return {
      gridColumnStart: startOffset + 2,
      gridColumnEnd: `span ${span}`,
    };
  }

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {format(viewStart, "MMM d")} – {format(viewEnd, "MMM d, yyyy")}
        </h2>
        <div className="flex items-center gap-2">
          <Tabs value={zoom} onValueChange={(v) => setZoom(v as Zoom)}>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="icon" onClick={() => setViewStart((d) => addDays(d, -dayCount))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setViewStart((d) => addDays(d, dayCount))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {groups.size === 0 ? (
        <p className="text-sm text-muted-foreground">No tasks with due dates in this range.</p>
      ) : (
        <div className="flex-1 overflow-auto rounded-lg border">
          <div style={{ minWidth: 180 + dayCount * dayWidth }}>
            <div
              className="sticky top-0 z-10 grid border-b bg-muted/40"
              style={{ gridTemplateColumns: `180px repeat(${dayCount}, ${dayWidth}px)` }}
            >
              <div className="border-r px-3 py-1.5 text-xs font-medium text-muted-foreground">Project</div>
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r px-1 py-1.5 text-center text-[11px] text-muted-foreground last:border-r-0",
                    isWeekend(day) && "bg-muted/40",
                    isToday(day) && "bg-primary/10 font-semibold text-primary"
                  )}
                >
                  {format(day, dayCount > 20 ? "d" : "EEE d")}
                </div>
              ))}
            </div>

            {Array.from(groups.entries()).map(([key, group]) => (
              <div key={key} className="border-b last:border-b-0">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `180px repeat(${dayCount}, ${dayWidth}px)` }}
                >
                  <div className="flex items-center gap-1.5 border-r px-3 py-2 text-xs font-medium">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                    <span className="truncate">{group.name}</span>
                  </div>
                </div>
                {group.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="grid items-center"
                    style={{ gridTemplateColumns: `180px repeat(${dayCount}, ${dayWidth}px)` }}
                  >
                    <div className="truncate border-r px-3 py-1.5 pl-6 text-xs text-muted-foreground">{t.title}</div>
                    <button
                      onClick={() => onTaskClick(t)}
                      style={barStyle(t)}
                      className={cn(
                        "my-1 h-5 truncate rounded px-2 text-left text-[11px] font-medium text-white hover:opacity-90",
                        t.status === "done" ? "bg-success" : "bg-primary"
                      )}
                      title={t.title}
                    >
                      {t.title}
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
