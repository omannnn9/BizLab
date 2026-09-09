import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/permissions";
import type { CompanyRole } from "@/types/database";

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"idle" | "accepting" | "error">("idle");
  const [error, setError] = useState<string>();
  const [role, setRole] = useState<CompanyRole>();

  useEffect(() => {
    if (!token || authLoading || !user || status !== "idle") return;

    setStatus("accepting");
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
  }, [token, authLoading, user, status, navigate]);

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
            <CardDescription>Sign in or create an account with the email this invite was sent to, then come back to this link.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild>
              <Link to={`/login?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/signup?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}>
                Create an account
              </Link>
            </Button>
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
