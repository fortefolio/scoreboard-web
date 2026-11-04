---
name: living-docs
description: "Automated codebase wiki documentation and continuous drift synchronization engine for scoreboard-web. Analyzes Next.js 16 App Router pages, UI components, broadcast overlay systems, scoring engines, and Supabase client hooks to generate and maintain a living Markdown wiki in docs/ with Mermaid diagrams. Activate this skill whenever asked to document the web frontend, update overlay docs, or sync web changes."
---

# Living Docs: Web Frontend Documentation & Continuous Sync

A local, autonomous documentation engine that functions as an intelligent, self-updating Code Wiki for `scoreboard-web`.

---

## 1. Documentation Architecture (`docs/`)

All project documentation lives in the `docs/` directory of `scoreboard-web`:

| File | Purpose | Key Contents |
| :--- | :--- | :--- |
| **[`docs/README.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/README.md)** | **Web Wiki Index** | Architecture overview, data flow diagram, and directory map. |
| **[`docs/01-architecture-web.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/01-architecture-web.md)** | **Next.js 16 App Router** | Route map, server vs client component boundary, styling, and navigation. |
| **[`docs/02-broadcast-overlays.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/02-broadcast-overlays.md)** | **OBS & vMix Broadcast Overlays** | Transparent stream overlays (`/overlay`), URL query params, hydration safety, and Realtime sync. |
| **[`docs/03-sports-engine.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/03-sports-engine.md)** | **Sports Scoring Engine** | Sport-specific rule engines, tiebreaks, Golden Points, and score models. |
| **[`docs/04-backend-integration.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/04-backend-integration.md)** | **Backend & Billing Contracts** | Supabase SSR cookies, Realtime channels, and Stripe checkout modal flows. |
| **[`docs/TERMS_AND_CONDITIONS.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/TERMS_AND_CONDITIONS.md)** | **Terms & GDPR Compliance** | End-user terms and GDPR policies presented on `/terms`. |

---

## 2. Workflows

### Incremental Drift Synchronization (After Code Changes)
Whenever pages, components, or overlay features are created or altered:
1. Inspect `git status` or `git diff` inside `scoreboard-web`.
2. Update the corresponding `docs/` file per `.agents/rules/docs-sync.md`.
3. Keep Mermaid diagrams accurate.
4. Commit doc updates alongside the TypeScript/React code changes.
