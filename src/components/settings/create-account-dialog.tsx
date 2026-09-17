import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInviteUser, type AdminCompany } from "@/hooks/use-admin";
import { ROLE_LABELS } from "@/lib/permissions";
import { generateTempPassword } from "@/lib/utils";
import type { CompanyRole } from "@/types/database";

const ROLES: CompanyRole[] = ["owner", "admin", "manager", "employee", "guest"];

/** The one place an account gets created from the Administration
 * console — used directly (People tab's "Invite user") and pre-filled
 * from a reviewed access request (Requests tab's "Approve"), so both
 * paths go through the exact same temp-password/must-change-password
 * flow (invite-user edge function) instead of drifting apart. */
export function CreateAccountDialog({
  open,
  onOpenChange,
  companies,
  defaultName = "",
  defaultEmail = "",
  onAccountHandled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: AdminCompany[] | undefined;
  defaultName?: string;
  defaultEmail?: string;
  /** Fires once the account exists (whether brand-new or an
   * invitation added to an existing account) — before the
   * temp-password success screen, so a caller can mark whatever
   * prompted this dialog (e.g. an access request) as handled right
   * away rather than waiting for "Done". */
  onAccountHandled?: () => void;
}) {
  const inviteUser = useInviteUser();
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [companyId, setCompanyId] = useState<string>();
  const [role, setRole] = useState<CompanyRole>("employee");
  const [tempPassword, setTempPassword] = useState(generateTempPassword);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setEmail(defaultEmail);
      setCompanyId(undefined);
      setRole("employee");
      setTempPassword(generateTempPassword());
      setCreated(null);
      setCopied(false);
    }
    // Only re-seed when the dialog opens, not on every defaultName/defaultEmail identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      onAccountHandled?.();
      if (result.accountCreated) {
        setCreated({ email, password: tempPassword });
      } else {
        toast.success(`${email} already has an account — invitation added`);
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the account");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{defaultEmail ? "Approve and create account" : "Invite a user"}</DialogTitle>
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
  );
}
