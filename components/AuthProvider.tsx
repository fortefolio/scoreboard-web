"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthChangeEvent, Session, SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);

      const hadSession = lastSessionRef.current !== null;
      lastSessionRef.current = session ?? null;

      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      } else if (event === "TOKEN_REFRESHED" && hadSession && !session) {
        router.refresh();
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase, router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      supabase,
      signOut: async () => {
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
