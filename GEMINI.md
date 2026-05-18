# Auth & session management

This project uses `@supabase/ssr`. Do not regress to the patterns below.

## Don't run the proxy codemod
- Auth runs in `middleware.ts` (Edge runtime), **not** `proxy.ts`.
- Next 16 deprecates `middleware` in favor of `proxy`, but `proxy` is Node-only and `@opennextjs/cloudflare` requires Edge middleware. The deploy will fail if you rename.
- The deprecation warning during `next build` is expected — leave it. Revisit only after Next ships Edge-runtime instructions for `proxy` (tracked in the v16 upgrade guide bundled in `node_modules/next/dist/docs/`).

## Three Supabase clients, never reach for `createClient`
- Browser code: `getSupabaseBrowserClient()` from `@/lib/supabase/client` (or `useAuth().supabase`).
- Server components / Server Actions / Route Handlers: `getSupabaseServerClient()` from `@/lib/supabase/server`.
- Middleware: `updateSession()` from `@/lib/supabase/proxy`.
- Don't import `createClient` from `@supabase/supabase-js` — it stores tokens in `localStorage` and bypasses the cookie-based session this migration is built on.
- `lib/supabase/index.ts` exports a legacy `supabase` browser singleton for older non-auth pages. Fine to use from existing files; new code should use the factories above.
- **Never import the barrel (`@/lib/supabase`) from a server component, `generateMetadata`, or a Route Handler.** The barrel has `"use client"`, so on the server Next ships a client-reference shim — `supabase.from` is undefined and you get `TypeError: ... .from is not a function` at runtime. Server contexts must call `getSupabaseServerClient()`. If you see "Module not found / .from is not a function" originating from a server file, check the import path first.

## `AuthProvider` owns all auth state on the client
- Read user state via `useAuth()` from `@/components/AuthProvider`. Don't call `supabase.auth.getSession()` / `getUser()` / `onAuthStateChange()` in components — the provider already does it once.
- Don't add `useEffect(() => { if (!session) router.push("/") })` route guards in pages. Route protection lives in `middleware.ts` (`PROTECTED_PREFIXES`). Add new protected routes there.

## Cookie write rules (Next 16)
- Writing cookies (`cookieStore.set(...)`) only works in Server Actions, Route Handlers, and middleware. Server Components will throw — `getSupabaseServerClient` swallows that error on purpose because middleware refreshes the session anyway.
- Auth callback (e.g. OAuth code exchange) must run in a Route Handler or Server Action, not a page.

## Don't SSR-seed the user in `app/layout.tsx`
- Next 16's Cache Components mode rejects uncached I/O in the root layout's render path. We tried; the workable shapes either double-render children on suspense resolve or reintroduce the hydration flash.
- If you need user data on the server, fetch it in a leaf server component wrapped in `<Suspense>` — and don't render any `useAuth()` consumer inside that boundary's fallback.

## Sign-out
- Use `useAuth().signOut()` — don't call `supabase.auth.signOut()` directly. The provider's listener handles router refresh; calling `router.push("/")` yourself causes a race.
