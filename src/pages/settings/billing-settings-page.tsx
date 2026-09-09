import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatBytes } from "@/lib/utils";
import { usePlans, useSubscription } from "@/hooks/use-billing";
import { useCompanyMembers } from "@/hooks/use-members";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";

export function BillingSettingsPage() {
  const { data: subscription } = useSubscription();
  const { data: plans } = usePlans();
  const { data: members } = useCompanyMembers();
  const { company } = useWorkspace();
  const { hasMinRole } = usePermissions();
  const canManage = hasMinRole("owner");
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  const memberCount = members?.length ?? 0;
  const plan = subscription?.plan;
  const memberLimit = plan?.max_members;
  const memberPct = memberLimit ? Math.min(100, Math.round((memberCount / memberLimit) * 100)) : 0;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            {subscription?.status === "trialing" ? "You're on a free trial" : "Your active subscription"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-semibold">{plan?.name}</p>
              <p className="text-sm text-muted-foreground">
                ${((plan?.price_monthly_cents ?? 0) / 100).toFixed(0)}/mo per workspace
              </p>
            </div>
            <Badge variant={subscription?.status === "active" ? "success" : "secondary"} className="capitalize">
              {subscription?.status}
            </Badge>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Team members</span>
              <span>{memberCount} / {memberLimit ?? "∞"}</span>
            </div>
            {memberLimit && <Progress value={memberPct} className="mt-1.5" />}
          </div>
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Storage quota</span>
              <span>{formatBytes(company?.storage_quota_bytes ?? 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Available plans</h3>
          <Tabs value={interval} onValueChange={(v) => setInterval(v as "monthly" | "annual")}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual (save ~20%)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans?.map((p) => (
            <Card key={p.id} className={p.id === plan?.id ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle>{p.name}</CardTitle>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  ${interval === "monthly" ? (p.price_monthly_cents / 100).toFixed(0) : (p.price_annual_cents / 100 / 12).toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                {interval === "annual" && (
                  <p className="text-xs text-muted-foreground">billed ${(p.price_annual_cents / 100).toFixed(0)}/year</p>
                )}
                <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" />
                    {p.max_members ?? "Unlimited"} members
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" />
                    {formatBytes(p.storage_quota_bytes)} storage
                  </li>
                  {Object.entries(p.features)
                    .filter(([, v]) => v === true)
                    .slice(0, 3)
                    .map(([k]) => (
                      <li key={k} className="flex items-center gap-1.5 capitalize">
                        <Check className="size-3.5 text-success" />
                        {k.replace(/_/g, " ")}
                      </li>
                    ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  variant={p.id === plan?.id ? "outline" : "default"}
                  className="w-full"
                  disabled={p.id === plan?.id || !canManage}
                  onClick={() => toast.info("Billing integration (Stripe) is on the roadmap — see docs/SUBSCRIPTION_MODEL.md")}
                >
                  {p.id === plan?.id ? "Current plan" : "Upgrade"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
