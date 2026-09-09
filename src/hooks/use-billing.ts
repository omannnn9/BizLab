import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";
import type { CompanySubscription, SubscriptionPlan } from "@/types/database";

export function useSubscription() {
  const { company } = useWorkspace();
  return useQuery({
    queryKey: ["subscription", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("company_id", company!.id)
        .single();
      if (error) throw error;
      return data as unknown as CompanySubscription;
    },
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as SubscriptionPlan[];
    },
  });
}
