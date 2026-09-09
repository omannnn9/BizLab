import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useConvertLead, type CrmLead, type CrmPipelineStage } from "@/hooks/use-crm";

export function ConvertLeadDialog({
  lead,
  open,
  onOpenChange,
  pipelineId,
  stages,
}: {
  lead: CrmLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: CrmPipelineStage[];
}) {
  const convertLead = useConvertLead();
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    try {
      await convertLead.mutateAsync({
        leadId: lead.id,
        pipelineId,
        stageId,
        amountCents: Math.round(parseFloat(amount || "0") * 100),
      });
      toast.success(`${lead.name} converted to an account, contact and deal`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not convert lead");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert "{lead?.name}"</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This creates an account{lead?.company_name ? ` (${lead.company_name})` : ""} and a contact, then opens
            a deal in your pipeline.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Starting stage</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dealAmount">Deal amount (USD)</Label>
              <Input id="dealAmount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={convertLead.isPending}>
              {convertLead.isPending && <Loader2 className="animate-spin" />}
              Convert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
