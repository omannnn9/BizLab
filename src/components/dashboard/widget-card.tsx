import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TONE_CHIP: Record<Tone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

type Tone = "primary" | "success" | "warning" | "destructive";

export function WidgetCard({
  title,
  icon: Icon,
  tone = "primary",
  children,
  colSpan = 1,
  onRemove,
}: {
  title: string;
  icon?: LucideIcon;
  tone?: Tone;
  children: ReactNode;
  colSpan?: 1 | 2 | 3;
  onRemove?: () => void;
}) {
  return (
    <Card
      className={cn(
        "group gap-3 py-4 transition-shadow hover:shadow-md",
        colSpan === 3 ? "col-span-3" : colSpan === 2 ? "col-span-2" : "col-span-1"
      )}
    >
      <CardHeader className="flex-row items-center gap-2.5 space-y-0 px-4">
        {Icon && (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONE_CHIP[tone])}>
            <Icon className="size-3.5" />
          </span>
        )}
        <CardTitle className="flex-1 text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={onRemove}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-4">{children}</CardContent>
    </Card>
  );
}
