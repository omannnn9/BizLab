import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";

export interface CrmPipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  position: number;
  probability_pct: number;
  is_won: boolean;
  is_lost: boolean;
}

export interface CrmDeal {
  id: string;
  company_id: string;
  pipeline_id: string;
  stage_id: string;
  account_id: string | null;
  contact_id: string | null;
  name: string;
  amount_cents: number;
  currency: string;
  status: "open" | "won" | "lost";
  expected_close_date: string | null;
  owner_member_id: string | null;
  created_at: string;
  account?: { id: string; name: string } | null;
}

export interface CrmLead {
  id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  source: string | null;
  status: "new" | "contacted" | "qualified" | "disqualified" | "converted";
  notes: string | null;
  created_at: string;
}

export interface CrmAccount {
  id: string;
  company_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  company_size: string | null;
  created_at: string;
}

export function usePipeline() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["crm-pipeline", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data: pipeline, error: pErr } = await supabase
        .from("crm_pipelines")
        .select("*")
        .eq("company_id", company!.id)
        .eq("is_default", true)
        .single();
      if (pErr) throw pErr;

      const { data: stages, error: sErr } = await supabase
        .from("crm_pipeline_stages")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .order("position", { ascending: true });
      if (sErr) throw sErr;

      return { pipeline, stages: (stages ?? []) as CrmPipelineStage[] };
    },
  });
}

export function useDeals() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["crm-deals", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_deals")
        .select("*, account:crm_accounts(id, name)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmDeal[];
    },
  });
}

export function useCreateDeal() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      pipelineId: string;
      stageId: string;
      accountId?: string | null;
      amountCents?: number;
    }) => {
      const { error } = await supabase.from("crm_deals").insert({
        company_id: company!.id,
        pipeline_id: input.pipelineId,
        stage_id: input.stageId,
        account_id: input.accountId ?? null,
        name: input.name,
        amount_cents: input.amountCents ?? 0,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["crm-deals", company?.id] }),
  });
}

export function useUpdateDealStage() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dealId, stageId, status }: { dealId: string; stageId: string; status?: CrmDeal["status"] }) => {
      const { error } = await supabase
        .from("crm_deals")
        .update({ stage_id: stageId, ...(status ? { status } : {}) })
        .eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["crm-deals", company?.id] }),
  });
}

export function useLeads() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["crm-leads", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CrmLead[];
    },
  });
}

export function useCreateLead() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email?: string; companyName?: string; source?: string }) => {
      const { error } = await supabase.from("crm_leads").insert({
        company_id: company!.id,
        name: input.name,
        email: input.email || null,
        company_name: input.companyName || null,
        source: input.source || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["crm-leads", company?.id] }),
  });
}

export function useConvertLead() {
  const { company } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      leadId,
      pipelineId,
      stageId,
      amountCents,
    }: {
      leadId: string;
      pipelineId: string;
      stageId: string;
      amountCents: number;
    }) => {
      const { data, error } = await supabase.rpc("convert_crm_lead", {
        p_lead_id: leadId,
        p_create_deal: true,
        p_pipeline_id: pipelineId,
        p_stage_id: stageId,
        p_deal_amount_cents: amountCents,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["crm-leads", company?.id] });
      void queryClient.invalidateQueries({ queryKey: ["crm-deals", company?.id] });
      void queryClient.invalidateQueries({ queryKey: ["crm-accounts", company?.id] });
      void queryClient.invalidateQueries({ queryKey: ["crm-contacts", company?.id] });
    },
  });
}

export function useAccounts() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["crm-accounts", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_accounts")
        .select("*")
        .eq("company_id", company!.id)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmAccount[];
    },
  });
}

export function useCreateAccount() {
  const { company } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; domain?: string; industry?: string }) => {
      const { error } = await supabase.from("crm_accounts").insert({
        company_id: company!.id,
        name: input.name,
        domain: input.domain || null,
        industry: input.industry || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["crm-accounts", company?.id] }),
  });
}
