import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Circle, Minus, Plus, Square, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSaveWhiteboard, useWhiteboard } from "@/hooks/use-whiteboards";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

interface CanvasElement {
  id: string;
  type: "sticky" | "rectangle" | "circle" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  text: string;
}

const STICKY_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];

export function WhiteboardEditorPage() {
  const { whiteboardId } = useParams<{ whiteboardId: string }>();
  const { data: whiteboard, isLoading } = useWhiteboard(whiteboardId);
  const saveWhiteboard = useSaveWhiteboard();
  const { company } = useWorkspace();
  const navigate = useNavigate();

  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panning = useRef<{ startX: number; startY: number; origin: { x: number; y: number } } | null>(null);
  const dragging = useRef<{ id: string; startX: number; startY: number; origin: { x: number; y: number } } | null>(
    null
  );
  const initialized = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (whiteboard && !initialized.current) {
      setElements((whiteboard.canvas_data.elements as CanvasElement[]) ?? []);
      initialized.current = true;
    }
  }, [whiteboard]);

  useEffect(() => {
    if (!initialized.current || !whiteboardId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveWhiteboard.mutateAsync({ id: whiteboardId, canvas_data: { elements, appState: { zoom, pan } } });
    }, 800);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements]);

  function addElement(type: CanvasElement["type"]) {
    const el: CanvasElement = {
      id: crypto.randomUUID(),
      type,
      x: (200 - pan.x) / zoom,
      y: (150 - pan.y) / zoom,
      width: type === "sticky" ? 180 : 140,
      height: type === "sticky" ? 140 : 100,
      color: type === "sticky" ? STICKY_COLORS[elements.length % STICKY_COLORS.length] : "#6366f1",
      text: "",
    };
    setElements((prev) => [...prev, el]);
  }

  function handleCanvasPointerDown(e: React.PointerEvent) {
    if (e.target !== e.currentTarget) return;
    panning.current = { startX: e.clientX, startY: e.clientY, origin: pan };
  }

  function handleCanvasPointerMove(e: React.PointerEvent) {
    if (panning.current) {
      const dx = e.clientX - panning.current.startX;
      const dy = e.clientY - panning.current.startY;
      setPan({ x: panning.current.origin.x + dx, y: panning.current.origin.y + dy });
    } else if (dragging.current) {
      const dx = (e.clientX - dragging.current.startX) / zoom;
      const dy = (e.clientY - dragging.current.startY) / zoom;
      const { id, origin } = dragging.current;
      setElements((prev) =>
        prev.map((el) => (el.id === id ? { ...el, x: origin.x + dx, y: origin.y + dy } : el))
      );
    }
  }

  function stopInteractions() {
    panning.current = null;
    dragging.current = null;
  }

  if (isLoading || !whiteboard) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/w/${company?.slug}/whiteboards`)}>
          <ArrowLeft /> Boards
        </Button>
        <span className="text-sm font-medium">{whiteboard.name}</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}>
            <Minus className="size-3.5" />
          </Button>
          <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-r py-3">
          <Button variant="outline" size="icon" onClick={() => addElement("sticky")} title="Sticky note">
            <StickyNote className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => addElement("rectangle")} title="Rectangle">
            <Square className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => addElement("circle")} title="Circle">
            <Circle className="size-4" />
          </Button>
        </div>

        <div
          className="relative flex-1 overflow-hidden bg-muted/20"
          style={{
            backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={stopInteractions}
          onPointerLeave={stopInteractions}
        >
          <div
            className="absolute left-0 top-0 origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
          >
            {elements.map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  dragging.current = { id: el.id, startX: e.clientX, startY: e.clientY, origin: { x: el.x, y: el.y } };
                }}
                className={cn(
                  "absolute cursor-move shadow-sm",
                  el.type === "sticky" && "rounded-md p-2",
                  el.type === "rectangle" && "rounded-md border-2",
                  el.type === "circle" && "rounded-full border-2"
                )}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width,
                  height: el.height,
                  backgroundColor: el.type === "sticky" ? el.color : "transparent",
                  borderColor: el.type !== "sticky" ? el.color : undefined,
                }}
              >
                {el.type === "sticky" && (
                  <textarea
                    value={el.text}
                    onPointerDown={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setElements((prev) =>
                        prev.map((p) => (p.id === el.id ? { ...p, text: e.target.value } : p))
                      )
                    }
                    className="h-full w-full resize-none border-none bg-transparent text-sm outline-none placeholder:text-black/40"
                    placeholder="Type something…"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
