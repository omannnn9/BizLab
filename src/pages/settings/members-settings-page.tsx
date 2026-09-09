import { useState } from "react";
import { toast } from "sonner";
import { Link2, Mail, Trash2, UserPlus } from "lucide-react";
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
  useInviteMember,
  usePendingInvitations,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/use-members";
import { usePermissions } from "@/hooks/use-permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import type { CompanyRole } from "@/types/database";

const ROLES: CompanyRole[] = ["owner", "admin", "manager", "employee", "guest"];

export function MembersSettingsPage() {
  const { data: members } = useCompanyMembers();
  const { data: invitations } = usePendingInvitations();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();
  const inviteMember = useInviteMember();
  const { can, hasMinRole } = usePermissions();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("employee");

  const canManage = can("members", "edit");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await inviteMember.mutateAsync({ email, role });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
      setInviteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invitation");
    }
  }

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
            Email delivery isn't connected yet (see docs/ROADMAP.md) — copy the link and send it
            directly for now.
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

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="flex flex-col gap-4">
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
            <DialogFooter>
              <Button type="submit" disabled={inviteMember.isPending}>Send invitation</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
