import { createContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Set when the session was just terminated because the account is disabled — shown once on the login page. */
  disabledMessage: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [disabledMessage, setDisabledMessage] = useState<string | null>(null);

  // A disabled account keeps a technically-valid Supabase session — RLS
  // is what actually locks out data access (see is_company_member /
  // current_role_in in 0022) — but the app itself should never let a
  // disabled user sit inside the shell believing they have access, so
  // this signs them out client-side the moment their profile shows
  // disabled_at, whether that's on initial load or on a later refresh.
  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    const loaded = data as Profile | null;
    if (loaded?.disabled_at) {
      setProfile(null);
      setDisabledMessage("This account has been disabled. Contact your BizLab administrator.");
      await supabase.auth.signOut();
      return;
    }
    setProfile(loaded);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) void loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        void loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id);
  }

  return (
    <AuthContext.Provider
      value={{ user: session?.user ?? null, session, profile, loading, disabledMessage, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}
