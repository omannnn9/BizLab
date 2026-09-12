import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/permissions";
import type { CompanyRole } from "@/types/database";

// A brand-new invitee arrives here via Supabase's own invite email link,
// which carries `type=invite` in the URL hash once supabase-js parses it
// into a session (detectSessionInUrl: true) — that's the signal this is
// a first-time acceptance that still needs a password, as opposed to an
// existing multi-company user who already has one and just clicked an
// invite link while signed in.
function wasInviteCallback() {
  return new URLSearchParams(window.location.hash.slice(1)).get("type") === "invite";
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"idle" | "needs-password" | "accepting" | "error">("idle");
  const [error, setError] = useState<string>();
  const [role, setRole] = useState<CompanyRole>();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    if (!token || authLoading || !user || status !== "idle") return;
    setStatus(wasInviteCallback() ? "needs-password" : "accepting");
  }, [token, authLoading, user, status]);

  useEffect(() => {
    if (status !== "accepting" || !token) return;

    supabase
      .rpc("accept_company_invitation", { p_token: token })
      .then(({ data, error: rpcError }) => {
        if (rpcError) {
          setError(rpcError.message);
          setStatus("error");
          return;
        }
        setRole(data.role);
        supabase
          .from("companies")
          .select("slug")
          .eq("id", data.company_id)
          .single()
          .then(({ data: company }) => {
            navigate(company ? `/w/${company.slug}` : "/workspaces", { replace: true });
          });
      });
  }, [status, token, navigate]);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSettingPassword(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSettingPassword(false);
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setStatus("accepting");
  }

  if (!token) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <Logo className="mb-2" />
            <CardTitle className="text-xl">Invalid invite link</CardTitle>
            <CardDescription>This link is missing its invitation token.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <Logo className="mb-2" />
            <CardTitle className="text-xl">You've been invited to BizLab</CardTitle>
            <CardDescription>
              Sign in with the email this invite was sent to, then come back to this link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link to={`/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "needs-password") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="items-center text-center">
            <Logo className="mb-2" />
            <CardTitle className="text-xl">Set your password</CardTitle>
            <CardDescription>Choose a password to finish setting up your BizLab account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetPassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={settingPassword} className="mt-1">
                {settingPassword && <Loader2 className="animate-spin" />}
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="mb-2" />
          <CardTitle className="text-xl">
            {status === "error" ? "Couldn't accept invitation" : "Joining workspace…"}
          </CardTitle>
          <CardDescription>
            {status === "error"
              ? error
              : role
                ? `You're now a ${ROLE_LABELS[role]}. Redirecting…`
                : "Hang tight, this only takes a second."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-4">
          {status === "accepting" && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
          {status === "error" && (
            <Button variant="outline" asChild>
              <Link to="/workspaces">Go to your workspaces</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
