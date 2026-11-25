import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadLocalEnvIfNeeded() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return;
  }
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Ignore if .env.local cannot be loaded
    }
  }
}

/**
 * Removes a temporary E2E user and any matches they created from local Supabase.
 * No-ops gracefully when SUPABASE_SERVICE_ROLE_KEY is unavailable.
 */
export async function cleanupE2EUserByEmail(email: string): Promise<void> {
  loadLocalEnvIfNeeded();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    const supabaseAdmin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = userRow?.id as string | undefined;

    if (!userId) {
      const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userId = authList?.users?.find((u) => u.email === email)?.id;
    }

    if (!userId) return;

    await supabaseAdmin.from("matches").delete().eq("organizer_id", userId);
    await supabaseAdmin.from("users").delete().eq("id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
  } catch (err) {
    console.warn(`[e2e-cleanup] Failed to clean up ${email}:`, err);
  }
}
