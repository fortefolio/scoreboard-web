# Testing plan

No test infra exists today. The codebase is ~5,600 LOC, mostly client
components with scoring/bracket/standings logic embedded inline. This
plan is tuned to where bugs are most expensive (auth + match logic).

## Stack recommendation

- **Vitest** + jsdom — fastest with Next 16/Turbopack, ESM-native, good
  module mocking
- **@testing-library/react** + `user-event` — component tests
- **MSW** *(optional)* — only if you go heavy on page-level integration
- **Playwright** — one E2E smoke path, no more

Jest works too but adds Babel/ts-jest overhead next to an
already-Turbopack-heavy build. Skip Cypress (slower than Playwright for
this app) and Bun's runner (not yet aligned with Next 16 conventions).

## Phase 0 — Wire it up *(~2 hours)*

- `npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react
  @testing-library/user-event @testing-library/jest-dom`
- `vitest.config.ts` with `environment: 'jsdom'`, path alias for `@/`
- `tests/setup.ts` registering jest-dom matchers, mocking
  `next/navigation` (`useRouter`, `useSearchParams`, `usePathname`)
- `package.json`: `"test": "vitest"`, `"test:run": "vitest run"`,
  `"test:e2e": "playwright test"`
- Mirror `lib/`, `components/`, `middleware` structure under `tests/`

## Phase 1 — Extract pure logic, then unit-test *(highest ROI)*

The scoring/bracket/standings code lives inside 400–900-line React
components today. Unit-testable only after extraction. **The extraction
itself is the win** — easier to reason about, easier to change.

Move to:

- `lib/scoring/tennis.ts` — `nextPoint(state, scorer)`, `nextGame`,
  `winsSet`, `winsMatch`; covers 0/15/30/40, deuce, AD, tiebreak
- `lib/scoring/volleyball.ts` — rally points to `points_per_set`,
  switch-server rule, set/match wins
- `lib/scoring/football.ts` — goal events, half/full-time predicates
  *(lower priority, mostly timer)*
- `lib/brackets/generate.ts` — `seedBracket(teams[])`,
  `advanceWinner(bracket, matchId)`
- `lib/standings/groups.ts` — W/L/points, set difference, head-to-head
  tiebreaker
- `lib/auth/protected-routes.ts` — `isProtected(pathname)` against
  `PROTECTED_PREFIXES`

Test files like `tests/lib/scoring/tennis.test.ts`. Each pure function
deserves 5–15 cases covering: happy path, edge case at boundary
(e.g. 40-40 → deuce → AD → game), invalid input. Target ~80% line
coverage in `lib/`.

**This phase pays back the largest debt in the codebase.**

## Phase 2 — Component tests with mocked Supabase *(~1 day)*

Mock `@/lib/supabase/client` so `getSupabaseBrowserClient()` returns a
stub with the same shape. Helpers under `tests/helpers/supabase-mock.ts`.

Tests worth writing:

- `AuthProvider`: initial user state, `signOut` clears,
  `onAuthStateChange` resubscribes once, `useAuth` throws outside
  provider
- `TopNavBar`: signed-in menu vs guest CTA; sign-out triggers `signOut`
- `NotificationBell`: unread badge count, mark-as-read updates local
  state, real-time INSERT toast
- `ConfirmationModal`, `RuleModal`: confirm/cancel callbacks, close on
  backdrop
- Home page auth modal: email/password validation, signup username
  uniqueness branch, `next=` redirect after login
- My-matches / my-tournaments create modals: required-field validation

Skip pages that are purely presentational lists — visual regression is
better caught by E2E or screenshots.

## Phase 3 — Middleware + server-client tests *(~half day)*

These are where regressions become security issues:

- `middleware.ts` / `lib/supabase/proxy.ts`:
  - Guest GET `/my-matches` → redirect to
    `/?auth=login&next=/my-matches`
  - Authenticated GET `/my-matches` → 200 pass-through
  - Cookie refresh: `setAll` writes mirror onto response
  - Static asset bypass via matcher
- `lib/supabase/server.ts`: `cookies().set` throwing in RSC is swallowed
- `app/match/[matchId]/page.tsx` `generateMetadata`:
  tournaments-as-array handling

Use `next/server`'s `NextRequest` constructor directly; no Next runtime
needed.

## Phase 4 — One E2E smoke path *(~half day)*

Playwright against `next dev`. Single happy-path spec:

1. Visit `/my-matches` as guest → redirected with `next=`
2. Sign up via modal → land on `/my-matches`
3. Create a match → appears in list
4. Open the match → score a point on the scoreboard → score visible on
   home `/`
5. Sign out → guest view restored

Needs a dedicated Supabase test project (free tier is fine) with a seed
script. Worth the setup cost because it exercises the full
auth-cookie-realtime stack — the part most likely to break silently.

## Phase 5 — CI *(~1 hour)*

- GitHub Actions workflow: `vitest run` on every PR (fast — pure logic +
  components)
- Nightly `playwright test` against a preview deploy
- Coverage gate: `lib/**` ≥ 80%, no gate on `components/**` / `app/**`
  (too noisy)

## Open questions before any of this starts

1. **Vitest, or locked into something else?**
2. **Do we have / want a test Supabase project**, or should component
   tests mock everything?
3. **Is E2E worth the setup**, or stop at component + middleware
   coverage?
4. **Priority**: catch regressions in **match-logic correctness**
   (Phase 1) or **auth/middleware** (Phase 3)? Different shapes.
