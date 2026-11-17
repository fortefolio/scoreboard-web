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

## Secret Management & Push Protection Guardrails
- **NEVER hardcode Supabase Secret Keys or service role keys** (strings matching `sb_secret_*` or service tokens) in any repository files (code, tests, mocks, configs, docs).
- GitHub Push Protection blocks any commit or push that contains strings starting with `sb_secret_`.
- Always read keys strictly via environment variables:
  `process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""`
- All secret keys for local development and testing belong strictly in `.env.local` or `.env.test.local`, which are gitignored.

## Test Integrity (No Silent Test Modifications)
- **NEVER modify, update, weaken, or delete existing tests** during new feature development or bug fixes unless the user explicitly asks to update tests.
- Always run affected tests (`npm run test:affected`) after changes.
- **If existing tests fail after new developments or bug fixes, STOP and report the failing tests and root cause back to the user** instead of editing the test files to make them pass.

---

## Pages, Views & Components Inventory (UI Audit Checklist)

Keep this list updated whenever routes or shared UI components are added or removed so full-app UI/UX passes cover every screen.

### App Router Pages (`app/`)
- `app/page.tsx` — Home feed (`Matches`, `Tournaments`, `Following`/`Favorites`), Search + Quick-Jump popover, `SportFilterBar`, Auth modal (`?auth=login|signup|forgot`)
- `app/match/[matchId]/page.tsx` → `app/match/[matchId]/MatchDetailClient.tsx` — Match Overview (hero card, set/game breakdown, Progress / Rules / Official tabs, Share / Stream Overlay / Delete)
- `app/match/[matchId]/scoreboard/page.tsx` — Live Scoreboard console (`TennisScoreboard.tsx`, `VolleyballScoreboard.tsx`, `FootballScoreboard.tsx`, `BasketballScoreboard.tsx`)
- `app/match/[matchId]/overlay/page.tsx` → `app/match/[matchId]/overlay/MatchOverlayClient.tsx` — Transparent broadcast overlay (OBS/vMix)
- `app/tournament/[id]/page.tsx` — Tournament Overview & Organizer Hub (`Teams`, `Standings`, `Group Matches`, `Bracket`, `Settings`)
- `app/tournament/[id]/signup/page.tsx` — Public tournament team registration
- `app/tournament/[id]/teams/page.tsx` — Public tournament roster
- `app/my-matches/page.tsx` — My Events: Matches organized by current user
- `app/my-tournaments/page.tsx` — My Events: Tournaments organized by current user
- `app/umpire-matches/page.tsx` — My Events: Matches user was invited to umpire
- `app/user/[username]/page.tsx` — Public organizer profile (matches & tournaments)
- `app/notifications/page.tsx` — Full notifications feed & umpire invitation actions
- `app/settings/page.tsx` — Account settings (`Profile`, `Preferences`, `Security`, `Danger Zone`)
- `app/terms/page.tsx` — Terms & Conditions / GDPR
- `app/auth/confirm/page.tsx` — Auth OTP confirmation & mobile deep-link handoff
- `app/auth/reset-password/page.tsx` — Password recovery

### Shared UI Components (`components/`)
- **Shell & Navigation:** `TopNavBar.tsx`, `BottomTabBar.tsx`, `Footer.tsx`, `LanguageSelector.tsx`, `NotificationBell.tsx`, `AuthProvider.tsx`, `MyWorkspaceTabs.tsx`
- **Landing:** `components/landing/GuestLandingHero.tsx`, `components/landing/TechnicalCapabilitiesSection.tsx`
- **Controls, Lists & Tables:** `WorkspaceControlsBar.tsx`, `SportFilterBar.tsx`, `DataTable.tsx`, `entityTableColumns.tsx`, `MatchCard.tsx`, `MatchListItem.tsx`, `Pagination.tsx`, `SelectField.tsx`
- **Match & Scoreboard:** `FollowButton.tsx` (`FollowButton` & `SportFavoriteButton`), `SportIcon.tsx`, `OfflineSyncBadge.tsx`, `components/match/MatchAtmosphereBackground.tsx`, `components/match/StreamOverlayModal.tsx`, `components/scoreboard/ScoreboardLayout.tsx`
- **Tournament:** `TournamentBracket.tsx`, `GroupMatchesView.tsx`, `GroupStandingsView.tsx`
- **Modals:** `ConfirmationModal.tsx`, `RuleModal.tsx`, `components/subscription/UpgradeModal.tsx`
