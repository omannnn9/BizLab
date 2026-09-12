import { Link, Navigate } from "react-router-dom";
import { Building2, Loader2, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/permissions";

export function WorkspacePicker() {
  const { data: companies, isLoading } = useMyCompanies();
  const { signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // There is no self-service workspace creation — a platform admin
  // provisions companies and invites people into them. Landing here
  // with zero memberships means the account exists but hasn't been
  // placed anywhere yet.
  if (!companies || companies.length === 0) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Logo className="mb-1" />
            <ShieldAlert className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No workspace access yet</p>
            <p className="text-sm text-muted-foreground">
              Your account hasn't been added to a company workspace. Contact your BizLab
              administrator to get access.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (companies.length === 1) {
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
      <h1 className="mb-1 text-2xl font-semibold">Choose a workspace</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pick which company you'd like to work in.
      </p>

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
    </div>
  );
}
