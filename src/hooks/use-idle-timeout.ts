import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;
const CHECK_INTERVAL_MS = 30_000;

/** Enforces companies.security_settings.session_timeout_minutes (Settings
 * → Security), which previously only ever set the value in the database
 * without anything acting on it. */
export function useIdleTimeout() {
  const { signOut } = useAuth();
  const { company } = useWorkspace();
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const markActive = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
  }, []);

  useEffect(() => {
    const timeoutMinutes = company?.security_settings?.session_timeout_minutes;
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60_000;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current >= timeoutMs) {
        clearInterval(interval);
        toast.info("You've been signed out after a period of inactivity.");
        void signOut();
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [company?.security_settings?.session_timeout_minutes, signOut]);
}
