import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
} as const;

/**
 * Creates a per-request Supabase client targeting the Read Replica (if configured)
 * for public, non-personalized, historical reads, or the Primary URL otherwise.
 */
export function getScalableClient(
  intent: "read_replica" | "primary_read" | "primary_admin" = "read_replica"
): SupabaseClient {
  const { url: defaultUrl, anonKey: defaultAnonKey } = supabaseEnv();

  if (intent === "primary_admin") {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for primary_admin intent");
    }
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl,
      serviceRoleKey,
      CLIENT_OPTIONS
    );
  }

  const targetUrl =
    intent === "read_replica"
      ? process.env.SUPABASE_READ_REPLICA_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl
      : process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl;

  return createClient(
    targetUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultAnonKey,
    CLIENT_OPTIONS
  );
}
