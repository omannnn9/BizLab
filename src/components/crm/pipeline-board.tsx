import { useState } from "react";
import { cn } from "@/lib/utils";
import { useUpdateDealStage, type CrmDeal, type CrmPipelineStage } from "@/hooks/use-crm";

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PipelineBoard({
  stages,
  deals,
  onDealClick,
}: {
  stages: CrmPipelineStage[];
  deals: CrmDeal[];
  onDealClick: (deal: CrmDeal) => void;
}) {
  const updateStage = useUpdateDealStage();
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  function handleDrop(stage: CrmPipelineStage, e: React.DragEvent) {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = e.dataTransfer.getData("text/deal-id");
    const deal = deals.find((d) => d.id === dealId);
    if (deal && deal.stage_id !== stage.id) {
      updateStage.mutate({
        dealId,
        stageId: stage.id,
        status: stage.is_won ? "won" : stage.is_lost ? "lost" : "open",
      });
    }
  }

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-6">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage_id === stage.id);
        const stageTotal = stageDeals.reduce((sum, d) => sum + d.amount_cents, 0);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStage(stage.id);
            }}
            onDragLeave={() => setDragOverStage(null)}
            onDrop={(e) => handleDrop(stage, e)}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
              dragOverStage === stage.id && "border-primary bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-medium">{stage.name}</span>
              <span className="text-xs text-muted-foreground">{formatMoney(stageTotal)}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3">
              {stageDeals.map((deal) => (
                <button
                  key={deal.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/deal-id", deal.id)}
                  onClick={() => onDealClick(deal)}
                  className="flex flex-col gap-1.5 rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md"
                >
                  <p className="text-sm font-medium">{deal.name}</p>
                  {deal.account && <p className="text-xs text-muted-foreground">{deal.account.name}</p>}
                  <p className="text-sm font-semibold text-primary">{formatMoney(deal.amount_cents)}</p>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
