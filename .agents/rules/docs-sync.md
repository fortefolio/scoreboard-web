# Continuous Documentation Synchronization (Docs-as-Code)

This project maintains a living, version-controlled technical wiki in `/docs`. 

To prevent documentation rot and maintain the benefits of a self-updating CodeWiki:

## 1. Synchronization Mandate
Whenever you create, modify, or delete features across the codebase, you **must update the corresponding documentation in `/docs` within the same working session**:

| Area Modified | Target Documentation File | What to Update |
| :--- | :--- | :--- |
| **Migrations & DB Schema** (`scoreboard-backend/supabase/migrations/`) | [`docs/00-core-schema.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/00-core-schema.md) | Table schemas, columns, constraints, RLS policies, custom RPCs, and the Mermaid ERD. |
| **Edge Functions & Webhooks** (`scoreboard-backend/supabase/functions/`) | [`docs/01-backend-supabase.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/01-backend-supabase.md) | Function endpoints, event handlers (e.g. Stripe webhook events), secrets, environment variables. |
| **Mobile App** (`scoreboard-mobile/`) | [`docs/02-frontend-mobile.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/02-frontend-mobile.md) | Navigation screens, offline queue mechanics, umpire interfaces. |
| **Web App & Overlays** (`scoreboard-web/`) | [`docs/03-frontend-web.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/03-frontend-web.md) | Next.js routes, client vs server components, OBS/vMix broadcast overlays, pricing/upgrade modals. |
| **Scoring Logic & Rules** (`lib/scoring/`) | [`docs/04-sports-engine.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/04-sports-engine.md) | Sport-specific rules (Tennis, Padel, Volleyball, Basketball, Football), tiebreak logic, golden points. |
| **Terms, Billing & Legal** | [`docs/TERMS_AND_CONDITIONS.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/docs/TERMS_AND_CONDITIONS.md) | Pricing tiers, GDPR compliance, cancellation terms, user responsibility clauses. |

## 2. Diagram Standards
- When data structures or flow changes, update the relevant **Mermaid diagrams** (ER diagrams, sequence diagrams, architecture flows).
- Quote special characters in labels: `id["Node (Details)"]`.

## 3. Commit Rule
- Include the updated documentation in the same git commit as the code changes whenever possible.
