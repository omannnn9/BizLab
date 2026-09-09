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

/**
 * Client-side plan-feature gate — same caveat as lib/permissions.ts:
 * this hides/disables UI for features the workspace's plan doesn't
 * include, but nothing in RLS currently enforces it server-side, so a
 * direct API call can still reach a gated table. Treat this as an
 * upsell/UX mechanism today, not a real entitlement boundary — see
 * docs/SUBSCRIPTION_MODEL.md for the plan to close that gap.
 */
export function useFeatureEnabled(feature: string): boolean {
  const { data: subscription } = useSubscription();
  const features = subscription?.plan?.features as Record<string, unknown> | undefined;
  return features?.[feature] === true;
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
