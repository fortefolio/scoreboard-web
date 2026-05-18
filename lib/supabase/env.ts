const PLACEHOLDER_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_KEY = "placeholder";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? PLACEHOLDER_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PLACEHOLDER_KEY;

  if (typeof window !== "undefined" && (url === PLACEHOLDER_URL || anonKey === PLACEHOLDER_KEY)) {
    throw new Error(
      "Supabase env vars missing at runtime — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url, anonKey };
}
