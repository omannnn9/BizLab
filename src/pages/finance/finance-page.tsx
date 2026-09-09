import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAddRevenueEntry,
  useCreateInvoice,
  useExpenses,
  useInvoices,
  useRevenueEntries,
  useReviewExpense,
  useSubmitExpense,
  useUpdateInvoiceStatus,
} from "@/hooks/use-finance";
import { usePermissions } from "@/hooks/use-permissions";

function formatMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

const EXPENSE_VARIANT = { pending: "secondary", approved: "success", rejected: "outline", reimbursed: "success" } as const;
const INVOICE_VARIANT = { draft: "outline", sent: "secondary", paid: "success", overdue: "outline", void: "outline" } as const;

export function FinancePage() {
  const { data: expenses } = useExpenses();
  const { data: invoices } = useInvoices();
  const { data: revenue } = useRevenueEntries();
  const submitExpense = useSubmitExpense();
  const reviewExpense = useReviewExpense();
  const createInvoice = useCreateInvoice();
  const updateInvoiceStatus = useUpdateInvoiceStatus();
  const addRevenue = useAddRevenueEntry();
  const { can } = usePermissions();
  const canManage = can("finance", "edit");

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [revenueSource, setRevenueSource] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");

  const totalRevenue = (revenue ?? []).reduce((sum, r) => sum + r.amount_cents, 0);
  const outstandingInvoices = (invoices ?? [])
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + i.amount_cents, 0);
  const pendingExpenses = (expenses ?? []).filter((e) => e.status === "pending").reduce((s, e) => s + e.amount_cents, 0);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Finance"
        description="Expenses, invoices and revenue tracking."
        actions={
          <Button onClick={() => setExpenseOpen(true)}>
            <Plus /> Submit expense
          </Button>
        }
      />

      {canManage && (
        <div className="grid grid-cols-3 gap-4 border-b p-6">
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Revenue recognized</p>
            <p className="text-2xl font-bold text-success">{formatMoney(totalRevenue)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Outstanding invoices</p>
            <p className="text-2xl font-bold">{formatMoney(outstandingInvoices)}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Pending expenses</p>
            <p className="text-2xl font-bold">{formatMoney(pendingExpenses)}</p>
          </CardContent></Card>
        </div>
      )}

      <Tabs defaultValue="expenses" className="flex flex-1 flex-col overflow-hidden">
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            {canManage && <TabsTrigger value="invoices">Invoices</TabsTrigger>}
            {canManage && <TabsTrigger value="revenue">Revenue</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="expenses" className="flex-1 overflow-y-auto px-6 py-4">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Category</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses?.map((exp) => (
                  <tr key={exp.id}>
                    <td className="px-4 py-2.5 font-medium">{exp.category}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{exp.description ?? "—"}</td>
                    <td className="px-4 py-2.5">{formatMoney(exp.amount_cents)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(exp.expense_date), "MMM d, yyyy")}</td>
                    <td className="px-4 py-2.5"><Badge variant={EXPENSE_VARIANT[exp.status]}>{exp.status}</Badge></td>
                    <td className="px-4 py-2.5 text-right">
                      {exp.status === "pending" && canManage && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => reviewExpense.mutate({ id: exp.id, status: "approved" })}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => reviewExpense.mutate({ id: exp.id, status: "rejected" })}>Reject</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {(!expenses || expenses.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No expenses yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {canManage && (
          <TabsContent value="invoices" className="flex-1 overflow-y-auto px-6 py-4">
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
                <Plus className="size-3.5" /> Invoice
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Client</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Due</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices?.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2.5 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-2.5">{inv.client_name}</td>
                      <td className="px-4 py-2.5">{formatMoney(inv.amount_cents)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={inv.status}
                          onChange={(e) => updateInvoiceStatus.mutate({ id: inv.id, status: e.target.value as typeof inv.status })}
                          className="rounded border bg-transparent px-1.5 py-0.5 text-xs"
                        >
                          {(["draft", "sent", "paid", "overdue", "void"] as const).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <Badge variant={INVOICE_VARIANT[inv.status]} className="ml-2">{inv.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {(!invoices || invoices.length === 0) && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No invoices yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}

        {canManage && (
          <TabsContent value="revenue" className="flex-1 overflow-y-auto px-6 py-4">
            <div className="mb-3 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setRevenueOpen(true)}>
                <Plus className="size-3.5" /> Revenue entry
              </Button>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Source</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {revenue?.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2.5 font-medium">{r.source}</td>
                      <td className="px-4 py-2.5 text-success">{formatMoney(r.amount_cents)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{format(new Date(r.recognized_date), "MMM d, yyyy")}</td>
                    </tr>
                  ))}
                  {(!revenue || revenue.length === 0) && (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No revenue logged yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit an expense</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!category.trim() || !amount) return;
              await submitExpense.mutateAsync({ category, amountCents: Math.round(parseFloat(amount) * 100) });
              setCategory("");
              setAmount("");
              setExpenseOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expAmount">Amount (USD)</Label>
              <Input id="expAmount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitExpense.isPending}>Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!invoiceNumber.trim() || !clientName.trim() || !invoiceAmount) return;
              await createInvoice.mutateAsync({
                invoiceNumber,
                clientName,
                amountCents: Math.round(parseFloat(invoiceAmount) * 100),
              });
              setInvoiceNumber("");
              setClientName("");
              setInvoiceAmount("");
              setInvoiceOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invNumber">Invoice number</Label>
              <Input id="invNumber" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client">Client</Label>
              <Input id="client" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invAmount">Amount (USD)</Label>
              <Input id="invAmount" type="number" min="0.01" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createInvoice.isPending}>Create invoice</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={revenueOpen} onOpenChange={setRevenueOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log revenue</DialogTitle></DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!revenueSource.trim() || !revenueAmount) return;
              await addRevenue.mutateAsync({ source: revenueSource, amountCents: Math.round(parseFloat(revenueAmount) * 100) });
              setRevenueSource("");
              setRevenueAmount("");
              setRevenueOpen(false);
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="source">Source</Label>
              <Input id="source" value={revenueSource} onChange={(e) => setRevenueSource(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="revAmount">Amount (USD)</Label>
              <Input id="revAmount" type="number" min="0.01" step="0.01" value={revenueAmount} onChange={(e) => setRevenueAmount(e.target.value)} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addRevenue.isPending}>Add</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
