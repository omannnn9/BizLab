import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MfaSettings } from "@/components/settings/mfa-settings";
import { useUpdateCompany } from "@/hooks/use-companies";
import { useWorkspace } from "@/hooks/use-workspace";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuditLogs, useExportComplianceReport } from "@/hooks/use-audit-logs";

export function SecuritySettingsPage() {
  const { company } = useWorkspace();
  const { can } = usePermissions();
  const updateCompany = useUpdateCompany();
  const { data: auditLogs } = useAuditLogs();
  const exportReport = useExportComplianceReport();
  const canManage = can("workspace_settings", "manage");
  const canViewAudit = can("audit_logs", "view");

  const [settings, setSettings] = useState(company?.security_settings);

  useEffect(() => setSettings(company?.security_settings), [company]);

  async function persist(next: typeof settings) {
    if (!company) return;
    setSettings(next);
    try {
      await updateCompany.mutateAsync({ id: company.id, security_settings: next });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update security settings");
    }
  }

  async function handleExport() {
    try {
      const count = await exportReport.mutateAsync();
      toast.success(`Exported ${count} audit events`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export the compliance report");
    }
  }

  if (!settings) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Your account</CardTitle>
          <CardDescription>Applies to your login only, across every workspace you belong to.</CardDescription>
        </CardHeader>
        <CardContent>
          <MfaSettings />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security policy</CardTitle>
          <CardDescription>
            Controls enforced across every member of this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require multi-factor authentication</Label>
              <p className="text-xs text-muted-foreground">
                Members without an authenticator app set up are asked to add one the next time they sign in.
              </p>
            </div>
            <Switch
              checked={settings.require_mfa}
              disabled={!canManage}
              onCheckedChange={(v) => void persist({ ...settings, require_mfa: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Single sign-on (SSO)</Label>
              <p className="text-xs text-muted-foreground">
                Requires a SAML/OIDC identity provider (Okta, Azure AD, etc.) configured for this Supabase
                project — this flag records intent but doesn't configure one on its own.
              </p>
            </div>
            <Switch
              checked={settings.sso_enabled}
              disabled={!canManage}
              onCheckedChange={(v) => void persist({ ...settings, sso_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Session timeout</Label>
              <p className="text-xs text-muted-foreground">Minutes of inactivity before a session expires.</p>
            </div>
            <Input
              type="number"
              className="w-28"
              disabled={!canManage}
              value={settings.session_timeout_minutes}
              onChange={(e) =>
                setSettings({ ...settings, session_timeout_minutes: Number(e.target.value) })
              }
              onBlur={() => void persist(settings)}
            />
          </div>
        </CardContent>
      </Card>

      {canViewAudit && (
        <Card>
          <CardHeader>
            <CardTitle>Audit log</CardTitle>
            <CardDescription>Security-relevant events across your workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLogs && auditLogs.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {auditLogs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium">{log.actor?.full_name ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">{log.action}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {canViewAudit && (
        <Button variant="outline" className="w-fit" onClick={handleExport} disabled={exportReport.isPending}>
          {exportReport.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Export compliance report (CSV)
        </Button>
      )}
    </div>
  );
}
