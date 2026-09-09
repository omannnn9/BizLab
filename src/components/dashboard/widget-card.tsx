import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function WidgetCard({
  title,
  children,
  colSpan = 1,
  onRemove,
}: {
  title: string;
  children: ReactNode;
  colSpan?: 1 | 2 | 3;
  onRemove?: () => void;
}) {
  return (
    <Card className={colSpan === 3 ? "col-span-3" : colSpan === 2 ? "col-span-2" : "col-span-1"}>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>{title}</CardTitle>
        {onRemove && (
          <Button variant="ghost" size="icon" className="size-6" onClick={onRemove}>
            <X className="size-3.5" />
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
