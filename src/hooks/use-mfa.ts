import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useMfaFactors() {
  return useQuery({
    queryKey: ["mfa-factors"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data.totp;
    },
  });
}

/** currentLevel/nextLevel differ when the user has a verified factor but
 * hasn't completed the challenge for *this* session yet — the signal
 * that a blocking "enter your code" step is needed before anything else. */
export function useAuthenticatorAssuranceLevel() {
  return useQuery({
    queryKey: ["mfa-aal"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return data;
    },
  });
}

export function useEnrollMfa() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      return { id: data.id, ...data.totp };
    },
  });
}

export function useVerifyMfaEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mfa-factors"] });
      void queryClient.invalidateQueries({ queryKey: ["mfa-aal"] });
    },
  });
}

export function useUnenrollMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (factorId: string) => {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["mfa-factors"] });
      void queryClient.invalidateQueries({ queryKey: ["mfa-aal"] });
    },
  });
}
