import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

const { url: defaultUrl, anonKey: defaultAnonKey } = supabaseEnv();

/**
 * Primary Supavisor Pooler (Port 6543, Transaction Mode)
 * Used for live officiating mutations, atomic scoring RPCs, and authenticated state updates.
 */
export const supabasePrimary = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY || defaultAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Read Replica Pooler (Port 5432 / Direct or Replica endpoint)
 * Used for historical match archives, completed tournament standings, public search, and spectator feeds.
 * Falls back transparently to the primary URL if SUPABASE_READ_REPLICA_URL is not defined.
 */
export const supabaseReplica = createClient(
  process.env.SUPABASE_READ_REPLICA_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Dynamic helper to choose between Primary and Read Replica based on read/write intent.
 */
export function getScalableClient(intent: "read_replica" | "primary_write" = "read_replica") {
  return intent === "primary_write" ? supabasePrimary : supabaseReplica;
}
