import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Building2, Loader2, LogOut, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Logo } from "@/components/shared/logo";
import { useMyCompanies } from "@/hooks/use-companies";
import { useCreateCompany } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/permissions";

function CreateWorkspaceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const createCompany = useCreateCompany();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    try {
      const company = await createCompany.mutateAsync({ name, industry: industry || undefined, userId: user.id });
      toast.success(`${name} created`);
      onOpenChange(false);
      setName("");
      setIndustry("");
      navigate(`/w/${company.slug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create workspace");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-name">Company name</Label>
            <Input id="ws-name" required autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ws-industry">Industry (optional)</Label>
            <Input id="ws-industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createCompany.isPending}>
              {createCompany.isPending && <Loader2 className="animate-spin" />}
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function WorkspacePicker() {
  const { data: companies, isLoading } = useMyCompanies();
  const { signOut, profile } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const canCreate = !!profile?.is_platform_admin;

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // There is no self-service workspace creation for regular members — a
  // platform admin provisions companies and invites people into them.
  // Landing here with zero memberships means the account exists but
  // hasn't been placed anywhere yet.
  if (!companies || companies.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Logo className="mb-1" />
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No workspace access yet</p>
            <p className="text-sm text-muted-foreground">
              Your account hasn't been added to a company workspace.{" "}
              {canCreate ? "Create one below, or contact another admin to get added to an existing one." : "Contact your BizLab administrator to get access."}
            </p>
            {canCreate && (
              <Button size="sm" className="mt-1" onClick={() => setCreateOpen(true)}>
                <Plus /> Create workspace
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </CardContent>
        </Card>
        <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    );
  }

  // Skip straight in for a regular member with exactly one workspace —
  // but not for a platform admin, who should always land on the picker
  // so "Create workspace" stays reachable even with only one membership.
  if (companies.length === 1 && !canCreate) {
    return <Navigate to={`/w/${companies[0].company.slug}`} replace />;
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <Logo />
        <Button variant="ghost" size="sm" onClick={() => void signOut()}>
          <LogOut /> Sign out
        </Button>
      </div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold">Choose a workspace</h1>
          <p className="text-sm text-muted-foreground">Pick which company you'd like to work in.</p>
        </div>
        {canCreate && (
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setCreateOpen(true)}>
            <Plus /> New workspace
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {companies.map((m) => (
          <Link key={m.company_id} to={`/w/${m.company.slug}`}>
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-3 py-3.5">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building2 className="size-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.company.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[m.role]}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
