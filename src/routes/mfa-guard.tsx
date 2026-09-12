import { useState } from "react";
import { Outlet } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAuthenticatorAssuranceLevel, useEnrollMfa, useMfaFactors, useVerifyMfaEnrollment } from "@/hooks/use-mfa";

function ChallengeScreen() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signOut } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const factor = factors.totp.find((f) => f.status === "verified");
      if (!factor) throw new Error("No verified authenticator found");
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="mb-2" />
          <CardTitle className="text-xl">Enter your authentication code</CardTitle>
          <CardDescription>Open your authenticator app and enter the current 6-digit code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="challenge-code">6-digit code</Label>
              <Input
                id="challenge-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="text-center text-lg tracking-widest"
              />
            </div>
            <Button type="submit" disabled={submitting || code.length !== 6}>
              {submitting && <Loader2 className="animate-spin" />}
              Verify
            </Button>
          </form>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => void signOut()}>
            Sign in as someone else
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MandatoryEnrollScreen() {
  const { signOut } = useAuth();
  const enroll = useEnrollMfa();
  const verify = useVerifyMfaEnrollment();
  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  async function handleStart() {
    try {
      const totp = await enroll.mutateAsync();
      setEnrolling({ factorId: totp.id, qrCode: totp.qr_code, secret: totp.secret });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start enrollment");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    try {
      await verify.mutateAsync({ factorId: enrolling.factorId, code });
      toast.success("Two-factor authentication enabled");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code — try again");
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="mb-2" />
          <ShieldCheck className="mb-1 size-8 text-primary" />
          <CardTitle className="text-xl">Set up two-factor authentication</CardTitle>
          <CardDescription>
            An administrator has required two-factor authentication for this workspace. Set it up now to
            continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!enrolling ? (
            <Button className="w-full" onClick={handleStart} disabled={enroll.isPending}>
              {enroll.isPending && <Loader2 className="animate-spin" />}
              Get started
            </Button>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col items-center gap-4">
              <img src={enrolling.qrCode} alt="MFA QR code" className="size-48 rounded-lg border" />
              <p className="break-all text-center text-xs text-muted-foreground">{enrolling.secret}</p>
              <div className="flex w-full flex-col gap-1.5">
                <Label htmlFor="enroll-code">6-digit code</Label>
                <Input
                  id="enroll-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="text-center text-lg tracking-widest"
                />
              </div>
              <Button type="submit" className="w-full" disabled={verify.isPending || code.length !== 6}>
                {verify.isPending && <Loader2 className="animate-spin" />}
                Verify and continue
              </Button>
            </form>
          )}
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/** Sits inside RequireAuth, in front of every authenticated route.
 * Two independent gates, checked in order:
 *  1. The user already has a verified TOTP factor but this session
 *     hasn't completed the challenge yet (aal1 -> aal2 available) —
 *     always enforced once a factor exists, regardless of company policy.
 *  2. Any company the user belongs to requires MFA and they have no
 *     verified factor at all — mandatory enrollment before proceeding.
 */
export function MfaGuard() {
  const { data: aal, isLoading: aalLoading } = useAuthenticatorAssuranceLevel();
  const { data: factors, isLoading: factorsLoading } = useMfaFactors();
  const { data: companies, isLoading: companiesLoading } = useMyCompanies();

  if (aalLoading || factorsLoading || companiesLoading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (aal && aal.currentLevel !== aal.nextLevel) {
    return <ChallengeScreen />;
  }

  const hasVerifiedFactor = factors?.some((f) => f.status === "verified");
  const anyCompanyRequiresMfa = companies?.some((m) => m.company.security_settings?.require_mfa);

  if (!hasVerifiedFactor && anyCompanyRequiresMfa) {
    return <MandatoryEnrollScreen />;
  }

  return <Outlet />;
}
