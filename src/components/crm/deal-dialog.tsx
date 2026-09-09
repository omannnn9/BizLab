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
import { useAccounts, useCreateDeal, type CrmPipelineStage } from "@/hooks/use-crm";

export function DealDialog({
  open,
  onOpenChange,
  pipelineId,
  stages,
  defaultStageId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelineId: string;
  stages: CrmPipelineStage[];
  defaultStageId?: string;
}) {
  const { data: accounts } = useAccounts();
  const createDeal = useCreateDeal();

  const [name, setName] = useState("");
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? "");
  const [accountId, setAccountId] = useState<string>("none");
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !stageId) return;
    await createDeal.mutateAsync({
      name,
      pipelineId,
      stageId,
      accountId: accountId === "none" ? null : accountId,
      amountCents: Math.round(parseFloat(amount || "0") * 100),
    });
    setName("");
    setAmount("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dealName">Deal name</Label>
            <Input id="dealName" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Stage</Label>
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
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input id="amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account</SelectItem>
                {accounts?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createDeal.isPending}>
              {createDeal.isPending && <Loader2 className="animate-spin" />}
              Create deal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
