"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = supabaseEnv();
  browserClient = createBrowserClient(url, anonKey);
  return browserClient;
}
