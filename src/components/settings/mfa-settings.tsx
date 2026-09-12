import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useEnrollMfa,
  useMfaFactors,
  useUnenrollMfa,
  useVerifyMfaEnrollment,
} from "@/hooks/use-mfa";

export function MfaSettings() {
  const { data: factors, isLoading } = useMfaFactors();
  const enroll = useEnrollMfa();
  const verify = useVerifyMfaEnrollment();
  const unenroll = useUnenrollMfa();

  const [enrolling, setEnrolling] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  const verifiedFactor = factors?.find((f) => f.status === "verified");

  async function handleStartEnroll() {
    try {
      const totp = await enroll.mutateAsync();
      setEnrolling({ factorId: totp.id, qrCode: totp.qr_code, secret: totp.secret });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start MFA enrollment");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!enrolling) return;
    try {
      await verify.mutateAsync({ factorId: enrolling.factorId, code });
      toast.success("Two-factor authentication enabled");
      setEnrolling(null);
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code — try again");
    }
  }

  async function handleUnenroll() {
    if (!verifiedFactor) return;
    try {
      await unenroll.mutateAsync(verifiedFactor.id);
      toast.success("Two-factor authentication disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disable MFA");
    }
  }

  if (isLoading) {
    return <div className="h-9 w-40 animate-pulse rounded bg-muted" />;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {verifiedFactor ? (
            <ShieldCheck className="size-4 text-success" />
          ) : (
            <ShieldOff className="size-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {verifiedFactor ? "Two-factor authentication is on" : "Two-factor authentication is off"}
            </p>
            <p className="text-xs text-muted-foreground">
              {verifiedFactor
                ? "An authenticator app is required at sign-in."
                : "Add an authenticator app for a second sign-in step."}
            </p>
          </div>
        </div>
        {verifiedFactor ? (
          <Button variant="outline" size="sm" onClick={handleUnenroll} disabled={unenroll.isPending}>
            {unenroll.isPending && <Loader2 className="animate-spin" />}
            Disable
          </Button>
        ) : (
          <Button size="sm" onClick={handleStartEnroll} disabled={enroll.isPending}>
            {enroll.isPending && <Loader2 className="animate-spin" />}
            Enable
          </Button>
        )}
      </div>

      <Dialog open={!!enrolling} onOpenChange={(open) => !open && setEnrolling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Scan this code with an authenticator app (Google Authenticator, 1Password, Authy), then enter
              the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          {enrolling && (
            <form onSubmit={handleVerify} className="flex flex-col items-center gap-4">
              <img src={enrolling.qrCode} alt="MFA QR code" className="size-48 rounded-lg border" />
              <p className="break-all text-center text-xs text-muted-foreground">{enrolling.secret}</p>
              <div className="flex w-full flex-col gap-1.5">
                <Label htmlFor="mfa-code">6-digit code</Label>
                <Input
                  id="mfa-code"
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
              <DialogFooter className="w-full">
                <Button type="submit" className="w-full" disabled={verify.isPending || code.length !== 6}>
                  {verify.isPending && <Loader2 className="animate-spin" />}
                  Verify and enable
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
