import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Link2, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCompanyMembers,
  usePendingInvitations,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/use-members";
import { useInviteUser } from "@/hooks/use-admin";
import { usePermissions } from "@/hooks/use-permissions";
import { useWorkspace } from "@/hooks/use-workspace";
import { ROLE_LABELS } from "@/lib/permissions";
import { generateTempPassword } from "@/lib/utils";
import type { CompanyRole } from "@/types/database";

const ROLES: CompanyRole[] = ["owner", "admin", "manager", "employee", "guest"];

function InviteDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
}) {
  const inviteUser = useInviteUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("employee");
  const [tempPassword, setTempPassword] = useState(generateTempPassword);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setRole("employee");
    setTempPassword(generateTempPassword());
    setCreated(null);
    setCopied(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
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
        toast.success(`${email} already has a BizLab account — added to pending invitations`);
        onOpenChange(false);
        reset();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
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
                  onOpenChange(false);
                  reset();
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite a team member</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <Input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input
                type="email"
                required
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r !== "owner").map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Temporary password</label>
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
                  They'll sign in with this and set their own password on first login. This account already has
                  no invite email to lose — share the password with them directly.
                </p>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={inviteUser.isPending}>
                  {inviteUser.isPending ? "Creating…" : "Create account"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function MembersSettingsPage() {
  const { company } = useWorkspace();
  const { data: members } = useCompanyMembers();
  const { data: invitations } = usePendingInvitations();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const { can, hasMinRole } = usePermissions();

  const [inviteOpen, setInviteOpen] = useState(false);

  const canManage = can("members", "edit");

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Team members</h2>
          <p className="text-sm text-muted-foreground">{members?.length ?? 0} people in this workspace</p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus /> Invite member
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border">
        {members?.map((m) => (
          <div key={m.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
            <Avatar>
              <AvatarFallback>{(m.profile?.full_name ?? m.profile?.email ?? "?")[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{m.profile?.full_name ?? "Unnamed"}</p>
              <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
            </div>
            {canManage && hasMinRole("admin") ? (
              <Select value={m.role} onValueChange={(v) => updateRole.mutate({ memberId: m.id, role: v as CompanyRole })}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Badge variant="outline">{ROLE_LABELS[m.role]}</Badge>
            )}
            {canManage && m.role !== "owner" && (
              <Button variant="ghost" size="icon" onClick={() => removeMember.mutate(m.id)}>
                <Trash2 className="size-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {invitations && invitations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">Pending invitations</h3>
          <p className="mb-2 text-xs text-muted-foreground">
            These are people who already have a BizLab account elsewhere — share this link with them directly to
            join this company too.
          </p>
          <div className="overflow-hidden rounded-lg border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
                <Mail className="size-4 text-muted-foreground" />
                <span className="flex-1 text-sm">{inv.email}</span>
                <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const link = `${window.location.origin}/accept-invite?token=${inv.token}`;
                    void navigator.clipboard.writeText(link);
                    toast.success("Invite link copied");
                  }}
                >
                  <Link2 className="size-3.5" /> Copy link
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} companyId={company?.id} />
    </div>
  );
}
