import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/services/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "@/hooks/use-toast";

type AuthErrorInfo = {
  message: string;
  timestamp: number;
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);
  const isMountedRef = useRef(true);

  const removeCurrentUser = useCallback(async () => {
    const { error } = await supabase.rpc("delete_current_user");
    if (error) {
      console.warn("Failed to delete current auth user", error);
    }
  }, []);

  const revokeAccess = useCallback(
    async ({ message, deleteAccount }: { message: string; deleteAccount?: boolean }) => {
      if (deleteAccount) {
        await removeCurrentUser();
      }

      await supabase.auth.signOut();
      if (!isMountedRef.current) return;

      toast({
        title: "Access denied",
        description: message,
        variant: "destructive",
      });

      setAuthError({
        message,
        timestamp: Date.now(),
      });
      setSession(null);
      setUser(null);
      setLoading(false);
    },
    [removeCurrentUser]
  );

  const enforceAccess = useCallback(
    async (incoming: Session | null) => {
      if (!incoming) {
        if (!isMountedRef.current) return;
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (!isMountedRef.current) return;
      setLoading(true);
      setAuthError(null);

      const email = incoming.user.email?.toLowerCase() ?? "";
      if (!email) {
        await revokeAccess({
          message: "Account is missing an email address.",
          deleteAccount: true,
        });
        return;
      }

      const { data: whitelistEntry, error: whitelistError } = await supabase
        .from("auth_whitelist")
        .select("id")
        .ilike("email", email)
        .maybeSingle();

      if (whitelistError) {
        console.error("Failed to check whitelist", whitelistError);
        await revokeAccess({
          message: "Unable to verify your access. Please try again later.",
          deleteAccount: false,
        });
        return;
      }

      if (!whitelistEntry) {
        await revokeAccess({
          message: "You don't have permission to acces this app.",
          deleteAccount: true,
        });
        return;
      }

      if (!isMountedRef.current) return;
      setSession(incoming);
      setUser(incoming.user ?? null);
      setLoading(false);
    },
    [revokeAccess]
  );

  useEffect(() => {
    let active = true;
    isMountedRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      void enforceAccess(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!active) return;
      void enforceAccess(newSession);
    });

    return () => {
      active = false;
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [enforceAccess]);


  const signInWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return {
    user,
    session,
    loading,
    authError,
    signInWithGoogle,
    signOut,
  };
}
