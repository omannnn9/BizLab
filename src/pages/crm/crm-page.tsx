import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { DealDialog } from "@/components/crm/deal-dialog";
import { ConvertLeadDialog } from "@/components/crm/convert-lead-dialog";
import {
  useAccounts,
  useCreateAccount,
  useCreateLead,
  useDeals,
  useLeads,
  usePipeline,
  type CrmLead,
} from "@/hooks/use-crm";

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const LEAD_STATUS_VARIANT: Record<CrmLead["status"], "secondary" | "success" | "outline"> = {
  new: "secondary",
  contacted: "secondary",
  qualified: "success",
  disqualified: "outline",
  converted: "success",
};

export function CrmPage() {
  const { data: pipelineData, isLoading: pipelineLoading } = usePipeline();
  const { data: deals } = useDeals();
  const { data: leads } = useLeads();
  const { data: accounts } = useAccounts();
  const createLead = useCreateLead();
  const createAccount = useCreateAccount();

  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<CrmLead | null>(null);

  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [accountName, setAccountName] = useState("");

  const totalPipelineValue = (deals ?? [])
    .filter((d) => d.status === "open")
    .reduce((sum, d) => sum + d.amount_cents, 0);
  const wonValue = (deals ?? []).filter((d) => d.status === "won").reduce((sum, d) => sum + d.amount_cents, 0);

  if (pipelineLoading || !pipelineData) return null;
  const { pipeline, stages } = pipelineData;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="CRM"
        description="Leads, accounts, contacts and your sales pipeline."
        actions={
          <>
            <Button variant="outline" onClick={() => setLeadDialogOpen(true)}>
              <Plus /> Lead
            </Button>
            <Button onClick={() => setDealDialogOpen(true)}>
              <Plus /> Deal
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 border-b p-6">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Open pipeline value</p>
            <p className="text-2xl font-bold">{formatMoney(totalPipelineValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Won (all time)</p>
            <p className="text-2xl font-bold text-success">{formatMoney(wonValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Open leads</p>
            <p className="text-2xl font-bold">
              {leads?.filter((l) => l.status !== "converted" && l.status !== "disqualified").length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="flex flex-1 flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="accounts">Accounts</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="pipeline" className="flex-1 overflow-hidden">
          <PipelineBoard stages={stages} deals={deals ?? []} onDealClick={() => {}} />
        </TabsContent>

        <TabsContent value="deals" className="flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Deal</th>
                  <th className="px-4 py-2 font-medium">Account</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {deals?.map((deal) => (
                  <tr key={deal.id}>
                    <td className="px-4 py-2.5 font-medium">{deal.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{deal.account?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">{stages.find((s) => s.id === deal.stage_id)?.name}</td>
                    <td className="px-4 py-2.5">{formatMoney(deal.amount_cents)}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={deal.status === "won" ? "success" : deal.status === "lost" ? "outline" : "secondary"}>
                        {deal.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Company</th>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads?.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-2.5 font-medium">{lead.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.company_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{lead.email ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>{lead.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {lead.status !== "converted" && (
                        <Button variant="outline" size="sm" onClick={() => setConvertingLead(lead)}>
                          Convert
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!leads || leads.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      No leads yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="accounts" className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setAccountDialogOpen(true)}>
              <Plus className="size-3.5" /> Account
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Domain</th>
                  <th className="px-4 py-2 font-medium">Industry</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {accounts?.map((account) => (
                  <tr key={account.id}>
                    <td className="px-4 py-2.5 font-medium">{account.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{account.domain ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{account.industry ?? "—"}</td>
                  </tr>
                ))}
                {(!accounts || accounts.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      No accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <DealDialog open={dealDialogOpen} onOpenChange={setDealDialogOpen} pipelineId={pipeline.id} stages={stages} />
      <ConvertLeadDialog
        lead={convertingLead}
        open={!!convertingLead}
        onOpenChange={(open) => !open && setConvertingLead(null)}
        pipelineId={pipeline.id}
        stages={stages}
      />

      <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New lead</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!leadName.trim()) return;
              await createLead.mutateAsync({ name: leadName, email: leadEmail, companyName: leadCompany });
              setLeadName("");
              setLeadEmail("");
              setLeadCompany("");
              setLeadDialogOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leadName">Name</Label>
              <Input id="leadName" value={leadName} onChange={(e) => setLeadName(e.target.value)} autoFocus required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leadEmail">Email</Label>
              <Input id="leadEmail" type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="leadCompany">Company</Label>
              <Input id="leadCompany" value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createLead.isPending}>Create lead</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!accountName.trim()) return;
              await createAccount.mutateAsync({ name: accountName });
              setAccountName("");
              setAccountDialogOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountName">Name</Label>
              <Input id="accountName" value={accountName} onChange={(e) => setAccountName(e.target.value)} autoFocus required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createAccount.isPending}>Create account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
