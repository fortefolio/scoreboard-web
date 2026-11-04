---
name: living-docs
description: "Automated codebase wiki documentation and continuous drift synchronization engine. Analyzes repository structure, database schemas, API endpoints, business logic, and UI architectures to generate and maintain a living Markdown wiki in /docs with Mermaid diagrams. Activate this skill whenever asked to document the codebase, create or update the project wiki, sync docs with recent changes, or map system architecture."
---

# Living Docs: Automated Codebase Wiki & Continuous Sync

A local, autonomous documentation engine that functions as an intelligent, self-updating Code Wiki for this repository. It eliminates documentation rot by syncing technical documentation alongside code changes.

---

## 1. Documentation Architecture (`/docs`)

All project documentation lives in the `/docs` directory at the repository root:

| File | Purpose | Key Contents |
| :--- | :--- | :--- |
| **[`docs/README.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/README.md)** | **Wiki Index & System Overview** | Monorepo layout, high-level architecture diagram, quickstart, technology stack summary. |
| **[`docs/00-core-schema.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/00-core-schema.md)** | **Database & Data Layer** | PostgreSQL tables, JSONB structures, RLS policies, custom RPC functions, ER diagram (`erDiagram`). |
| **[`docs/01-backend-supabase.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/01-backend-supabase.md)** | **Backend & Edge Services** | Supabase Edge Functions (`stripe-webhook`, checkout/portal sessions), Auth lifecycle, Realtime channels. |
| **[`docs/02-frontend-mobile.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/02-frontend-mobile.md)** | **Mobile Application** | React Native / Expo stack, navigation architecture, offline sync queue, umpire scoring controls. |
| **[`docs/03-frontend-web.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/03-frontend-web.md)** | **Web Application** | Next.js 16 (App Router), spectator views, live scoreboard, OBS/vMix stream overlays, Pro billing. |
| **[`docs/04-sports-engine.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/04-sports-engine.md)** | **Rules & Scoring Logic** | Sport-specific rule engines (Tennis, Padel, Volleyball, Beach Volleyball, Basketball, Football), tiebreak rules, golden points. |
| **[`docs/TERMS_AND_CONDITIONS.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/TERMS_AND_CONDITIONS.md)** | **Legal & Compliance** | Terms of service, subscription tiers, GDPR compliance, data retention, user responsibility disclaimers. |

---

## 2. Execution Workflows

### Workflow A: Incremental Drift Synchronization (After Code Changes)

Whenever features, migrations, or endpoints are added or updated:

1. **Detect Changes**:
   - Inspect modified files using `git status` or `git diff --stat HEAD~1`.
2. **Classify Impact**:
   - Schema / Migrations (`scoreboard-backend/supabase/migrations/`) ➔ Update `docs/00-core-schema.md`.
   - Edge Functions / Webhooks (`scoreboard-backend/supabase/functions/`) ➔ Update `docs/01-backend-supabase.md`.
   - Web Pages / Components (`scoreboard-web/app/`, `components/`) ➔ Update `docs/03-frontend-web.md`.
   - Mobile Screens / Hooks (`scoreboard-mobile/`) ➔ Update `docs/02-frontend-mobile.md`.
   - Scoring Libraries (`lib/scoring/`) ➔ Update `docs/04-sports-engine.md`.
3. **Synchronize Content**:
   - Add new tables, columns, RPC signatures, or route paths.
   - Update Mermaid diagrams if relationships or flows changed.
   - Maintain bidirectional links using `file://` URLs.
4. **Commit Together**:
   - Ensure doc changes are committed in the same commit or immediately alongside the code change.

---

### Workflow B: Full Wiki Regeneration / Audit

When the user requests a full wiki update or audit:

1. **Schema Extraction**:
   - Read all migrations in `scoreboard-backend/supabase/migrations/` to rebuild the comprehensive table inventory and ERD.
2. **Architecture Mapping**:
   - Review monorepo packages (`scoreboard-web`, `scoreboard-mobile`, `scoreboard-backend`).
   - Draw the end-to-end data flow using Mermaid (`flowchart TD` / `sequenceDiagram`).
3. **Sports Engine Review**:
   - Document supported sport variants, set structures, and scoring edge-cases.
4. **Update Index (`docs/README.md`)**:
   - Re-index all modules with descriptions and status.

---

## 3. Formatting & Diagram Guidelines

To ensure maximum clarity and prevent rendering issues in markdown viewers:

- **Mermaid Diagrams**:
  - Always quote node labels containing parentheses or special characters: `match["Match Details (Live)"]`.
  - Use `erDiagram` for data models and `sequenceDiagram` for complex multi-party interactions (e.g. Stripe checkout ➔ webhook ➔ Supabase ➔ client).
  - Use `flowchart TD` or `flowchart LR` for system architecture.
- **Code Symbol Links**:
  - Link files using standard GitHub/local `file://` URLs: `[MatchDetailClient.tsx](file:///absolute/path/to/file#L1-L20)`.
- **Integrity**:
  - Never fabricate non-existent endpoints or tables; always inspect actual source code before documenting.
