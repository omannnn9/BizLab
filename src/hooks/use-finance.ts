import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";

export interface FinanceExpense {
  id: string;
  company_id: string;
  category: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  expense_date: string;
  status: "pending" | "approved" | "rejected" | "reimbursed";
  submitted_by: string;
}

export interface FinanceInvoice {
  id: string;
  company_id: string;
  invoice_number: string;
  client_name: string;
  amount_cents: number;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  issue_date: string;
  due_date: string | null;
}

export interface FinanceRevenueEntry {
  id: string;
  source: string;
  amount_cents: number;
  recognized_date: string;
}

export function useExpenses() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["finance-expenses", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_expenses")
        .select("*")
        .eq("company_id", company!.id)
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceExpense[];
    },
  });
}

export function useSubmitExpense() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { category: string; description?: string; amountCents: number }) => {
      const { error } = await supabase.from("finance_expenses").insert({
        company_id: company!.id,
        category: input.category,
        description: input.description || null,
        amount_cents: input.amountCents,
        submitted_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finance-expenses", company?.id] }),
  });
}

export function useReviewExpense() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FinanceExpense["status"] }) => {
      const { error } = await supabase
        .from("finance_expenses")
        .update({ status, reviewed_by: user!.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finance-expenses", company?.id] }),
  });
}

export function useInvoices() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["finance-invoices", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_invoices")
        .select("*")
        .eq("company_id", company!.id)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceInvoice[];
    },
  });
}

export function useCreateInvoice() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { invoiceNumber: string; clientName: string; amountCents: number; dueDate?: string }) => {
      const { error } = await supabase.from("finance_invoices").insert({
        company_id: company!.id,
        invoice_number: input.invoiceNumber,
        client_name: input.clientName,
        amount_cents: input.amountCents,
        due_date: input.dueDate || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finance-invoices", company?.id] }),
  });
}

export function useUpdateInvoiceStatus() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FinanceInvoice["status"] }) => {
      const { error } = await supabase
        .from("finance_invoices")
        .update({ status, ...(status === "paid" ? { paid_at: new Date().toISOString() } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finance-invoices", company?.id] }),
  });
}

export function useRevenueEntries() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["finance-revenue", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_revenue_entries")
        .select("*")
        .eq("company_id", company!.id)
        .order("recognized_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FinanceRevenueEntry[];
    },
  });
}

export function useAddRevenueEntry() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { source: string; amountCents: number; recognizedDate?: string }) => {
      const { error } = await supabase.from("finance_revenue_entries").insert({
        company_id: company!.id,
        source: input.source,
        amount_cents: input.amountCents,
        recognized_date: input.recognizedDate || new Date().toISOString().slice(0, 10),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["finance-revenue", company?.id] }),
  });
}
