import { useState } from "react";
import { Outlet } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/shared/logo";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

/** Sits inside RequireAuth, before MfaGuard: an admin-created account
 * starts with a temp password and profiles.must_change_password = true
 * (0030_forced_password_change.sql) — blocks the rest of the app until
 * a real password is set. */
export function PasswordChangeGuard() {
  const { profile, loading, refreshProfile, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex h-svh w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile?.must_change_password) return <Outlet />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { error: clearError } = await supabase.rpc("clear_must_change_password");
      if (clearError) throw clearError;
      await refreshProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set your new password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Logo className="mb-2" />
          <KeyRound className="mb-1 size-8 text-primary" />
          <CardTitle className="text-xl">Set a new password</CardTitle>
          <CardDescription>
            You're signing in with a temporary password. Choose your own before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-new-password">Confirm password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting} className="mt-1">
              {submitting && <Loader2 className="animate-spin" />}
              Continue
            </Button>
          </form>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
