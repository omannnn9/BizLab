import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Ban,
  Building2,
  Check,
  Copy,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { useAuth } from "@/hooks/use-auth";
import {
  useAllCompanies,
  useAllProfiles,
  useCreateCompany,
  useInviteUser,
  usePlatformAuditLog,
  useSetPlatformAdmin,
  useSetUserDisabled,
  useUpdateCompanyStorageQuota,
  type AdminCompany,
} from "@/hooks/use-admin";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, PERMISSION_MATRIX } from "@/lib/permissions";
import { formatBytes, generateTempPassword } from "@/lib/utils";
import type { CompanyRole } from "@/types/database";

const ROLES: CompanyRole[] = ["owner", "admin", "manager", "employee", "guest"];

function PeopleTab() {
  const { data: profiles, isLoading } = useAllProfiles();
  const { data: companies } = useAllCompanies();
  const { user } = useAuth();
  const setDisabled = useSetUserDisabled();
  const setPlatformAdmin = useSetPlatformAdmin();
  const inviteUser = useInviteUser();

  async function handleToggleAdmin(targetId: string, nextIsAdmin: boolean) {
    try {
      await setPlatformAdmin.mutateAsync({ userId: targetId, isAdmin: nextIsAdmin });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update platform admin status");
    }
  }

  async function handleToggleDisabled(targetId: string, nextDisabled: boolean) {
    if (nextDisabled) {
      if (targetId === user?.id) {
        toast.error("You can't disable your own account.");
        return;
      }
      if (!window.confirm("Disable this user? They lose access to every company immediately.")) return;
    }
    try {
      await setDisabled.mutateAsync({ userId: targetId, disabled: nextDisabled });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update user status");
    }
  }

  const [inviteOpen, setInviteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState<string>();
  const [role, setRole] = useState<CompanyRole>("employee");
  const [tempPassword, setTempPassword] = useState(generateTempPassword);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function resetInvite() {
    setName("");
    setEmail("");
    setCompanyId(undefined);
    setRole("employee");
    setTempPassword(generateTempPassword());
    setCreated(null);
    setCopied(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) {
      toast.error("Choose a company");
      return;
    }
    try {
      const result = await inviteUser.mutateAsync({
        email,
        full_name: name,
        company_id: companyId,
        role,
        temp_password: tempPassword,
      });
      if (result.accountCreated) {
        setCreated({ email, password: tempPassword });
      } else {
        toast.success(`${email} already has an account — invitation added`);
        setInviteOpen(false);
        resetInvite();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{profiles?.length ?? 0} people across all companies</p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus /> Invite user
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        {profiles?.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Avatar>
              <AvatarFallback>{(p.full_name ?? p.email)[0]}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{p.full_name ?? "Unnamed"}</p>
                {p.is_platform_admin && (
                  <Badge variant="outline" className="gap-1 text-primary">
                    <ShieldCheck className="size-3" /> Platform admin
                  </Badge>
                )}
                {p.disabled_at && <Badge variant="destructive">Disabled</Badge>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{p.email}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={setPlatformAdmin.isPending}
              onClick={() => void handleToggleAdmin(p.id, !p.is_platform_admin)}
            >
              <UserCog className="size-3.5" />
              {p.is_platform_admin ? "Revoke admin" : "Make admin"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={setDisabled.isPending || p.id === user?.id}
              onClick={() => void handleToggleDisabled(p.id, !p.disabled_at)}
            >
              <Ban className="size-3.5" />
              {p.disabled_at ? "Reactivate" : "Disable"}
            </Button>
          </div>
        ))}
      </div>

      <Dialog
        open={inviteOpen}
        onOpenChange={(next) => {
          setInviteOpen(next);
          if (!next) resetInvite();
        }}
      >
        <DialogContent>
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle>Account created</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Share this temporary password with <span className="font-medium text-foreground">{created.email}</span>{" "}
                  directly — they'll be asked to set their own the first time they sign in.
                </p>
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
                  <span className="flex-1 select-all">{created.password}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={async () => {
                      await navigator.clipboard.writeText(created.password);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                  >
                    {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setInviteOpen(false);
                    resetInvite();
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Invite a user</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-name">Name</Label>
                  <Input id="invite-name" required value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Company</Label>
                  <Select value={companyId} onValueChange={setCompanyId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Temporary password</Label>
                    <button
                      type="button"
                      onClick={() => setTempPassword(generateTempPassword())}
                      className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <RefreshCw className="size-3" /> Generate new
                    </button>
                  </div>
                  <Input
                    required
                    minLength={8}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    They'll sign in with this and set their own password on first login.
                  </p>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={inviteUser.isPending}>
                    {inviteUser.isPending && <Loader2 className="animate-spin" />}
                    Create account
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StorageQuotaDialog({
  company,
  open,
  onOpenChange,
}: {
  company: AdminCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateQuota = useUpdateCompanyStorageQuota();
  const [gb, setGb] = useState("");

  useEffect(() => {
    if (company) setGb(String(Math.round(company.storage_quota_bytes / 1_000_000_000)));
  }, [company]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    const parsed = Number(gb);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a storage limit greater than 0 GB");
      return;
    }
    try {
      await updateQuota.mutateAsync({ companyId: company.id, quotaBytes: Math.round(parsed * 1_000_000_000) });
      toast.success(`Storage limit for ${company.name} updated to ${parsed} GB`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update storage limit");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Storage limit — {company?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="storage-gb">Limit (GB)</Label>
            <Input
              id="storage-gb"
              type="number"
              min={1}
              step={1}
              required
              value={gb}
              onChange={(e) => setGb(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Currently {company ? formatBytes(company.storage_quota_bytes) : "—"}. No billing plans here — set
              whatever this company actually needs.
            </p>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateQuota.isPending}>
              {updateQuota.isPending && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompaniesTab() {
  const { user } = useAuth();
  const { data: companies, isLoading } = useAllCompanies();
  const createCompany = useCreateCompany();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [quotaCompany, setQuotaCompany] = useState<AdminCompany | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    try {
      await createCompany.mutateAsync({ name, industry: industry || undefined, userId: user.id });
      toast.success(`${name} created`);
      setCreateOpen(false);
      setName("");
      setIndustry("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create company");
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{companies?.length ?? 0} companies</p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> Create company
        </Button>
      </div>

      {companies && companies.length === 0 ? (
        <EmptyState icon={Building2} title="No companies yet" description="Create the first one to get started." />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {companies?.map((c) => (
            <div key={c.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {c.industry ?? "No industry set"} · {c.member_count} member{c.member_count === 1 ? "" : "s"} ·{" "}
                  {formatBytes(c.storage_quota_bytes)} storage limit
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setQuotaCompany(c)}>
                <HardDrive className="size-3.5" /> Storage limit
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/w/${c.slug}/settings/members`}>Manage members</Link>
              </Button>
            </div>
          ))}
        </div>
      )}

      <StorageQuotaDialog
        company={quotaCompany}
        open={!!quotaCompany}
        onOpenChange={(open) => !open && setQuotaCompany(null)}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a company</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-name">Company name</Label>
              <Input id="company-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-industry">Industry (optional)</Label>
              <Input id="company-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createCompany.isPending}>
                {createCompany.isPending && <Loader2 className="animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecurityTab() {
  const { data: entries, isLoading } = usePlatformAuditLog();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold">Platform audit log</h3>
        <p className="text-sm text-muted-foreground">
          Admin actions — user creation, disable/reactivate, admin grants — across every company.
          Per-company activity lives in that workspace's own Security tab.
        </p>
      </div>
      {!entries || entries.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No platform-level events yet" />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 border-b px-4 py-2.5 text-sm last:border-b-0">
              <span className="font-mono text-xs text-muted-foreground">{e.action}</span>
              <span className="flex-1 truncate text-muted-foreground">
                {e.actor?.full_name ?? e.actor?.email ?? "system"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccessTab() {
  const resources = Object.keys(PERMISSION_MATRIX) as (keyof typeof PERMISSION_MATRIX)[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-sm font-semibold">Roles</h3>
        <div className="mt-2 overflow-hidden rounded-lg border">
          {(["owner", "admin", "manager", "employee", "guest"] as CompanyRole[]).map((r) => (
            <div key={r} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
              <Badge variant="outline" className="mt-0.5 w-20 shrink-0 justify-center">
                {ROLE_LABELS[r]}
              </Badge>
              <p className="text-sm text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Permission matrix</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Minimum role required per action. Enforced server-side by PostgreSQL row-level security —
          this table is a reference, not an editor.
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-4 py-2 font-medium">Resource</th>
                <th className="px-4 py-2 font-medium">View</th>
                <th className="px-4 py-2 font-medium">Create</th>
                <th className="px-4 py-2 font-medium">Edit</th>
                <th className="px-4 py-2 font-medium">Delete</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-medium capitalize">{r.replace("_", " ")}</td>
                  {(["view", "create", "edit", "delete"] as const).map((action) => (
                    <td key={action} className="px-4 py-2 text-muted-foreground">
                      {PERMISSION_MATRIX[r][action] ? ROLE_LABELS[PERMISSION_MATRIX[r][action]!] : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function AdministrationPage() {
  const { profile } = useAuth();

  if (!profile?.is_platform_admin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Access denied"
        description="Administration is only available to BizLab platform administrators."
      />
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Platform-wide controls — visible only to platform administrators.
        </p>
      </div>
      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
        </TabsList>
        <TabsContent value="people" className="mt-4">
          <PeopleTab />
        </TabsContent>
        <TabsContent value="companies" className="mt-4">
          <CompaniesTab />
        </TabsContent>
        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
        <TabsContent value="access" className="mt-4">
          <AccessTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
