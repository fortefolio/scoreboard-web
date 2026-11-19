"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, SupabaseClient, User, UserResponse } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { clearOfflineQueue } from "@/lib/offline/offlineQueue";

type AuthContextValue = {
  user: User | null;
  supabase: SupabaseClient;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: User | null;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(initialUser);
  const lastSessionRef = useRef<Session | null>(null);
  const lastUserIdRef = useRef<string | null>(initialUser?.id ?? null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const nextUserId = session?.user?.id ?? null;
      setUser(session?.user ?? null);

      const hadSession = lastSessionRef.current !== null;
      const prevUserId = lastUserIdRef.current;
      lastSessionRef.current = session ?? null;
      if (nextUserId) {
        lastUserIdRef.current = nextUserId;
      }

      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        if (event === "SIGNED_OUT" || (prevUserId && nextUserId && prevUserId !== nextUserId)) {
          clearOfflineQueue();
        }
        if (event === "SIGNED_OUT") {
          lastUserIdRef.current = null;
        }
        router.refresh();
      } else if (event === "TOKEN_REFRESHED" && hadSession && !session) {
        clearOfflineQueue();
        lastUserIdRef.current = null;
        router.refresh();
      }
    });

    // Validate stored token against current Supabase environment; clear only if token signature is invalid or revoked
    supabase.auth.getUser().then((res: UserResponse) => {
      const error = res.error;
      if (
        error &&
        error.name !== "AuthSessionMissingError" &&
        (error.message?.toLowerCase().includes("signature") ||
         error.message?.toLowerCase().includes("invalid jwt") ||
         error.message?.toLowerCase().includes("invalid refresh token") ||
         error.status === 401)
      ) {
        console.warn("Invalid or mismatched session detected, clearing auth state:", error.message);
        supabase.auth.signOut();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      supabase,
      signOut: async () => {
        clearOfflineQueue();
        await supabase.auth.signOut();
      },
    }),
    [user, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
