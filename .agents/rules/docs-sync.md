# Web Documentation Synchronization Rule (Docs-as-Code)

This repository maintains a living technical wiki in `docs/` describing the Next.js 16 App Router architecture, UI components, broadcast overlay engine, and backend integrations.

## 1. Synchronization Mandate
Whenever you create, modify, or delete frontend components, you **must update the corresponding documentation in `docs/` within the same working session**:

| Area Modified | Target Documentation File | What to Update |
| :--- | :--- | :--- |
| **Routes & Pages** (`app/`) | [`docs/01-architecture-web.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/01-architecture-web.md) | New routes, SSR vs Client components, navigation, layouts, and theme changes. |
| **Broadcast Overlays** (`app/match/[matchId]/overlay/`, `components/overlay/`) | [`docs/02-broadcast-overlays.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/02-broadcast-overlays.md) | Query parameter options (`pos`, `scale`, `theme`), hydration guards, OBS styling. |
| **Scoring Logic & Calculations** (`lib/scoring/`) | [`docs/03-sports-engine.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/03-sports-engine.md) | Sport rules (Tennis, Padel, Volleyball, Basketball, Football), tiebreak calculations, Golden Points. |
| **Supabase & API Integration** (`lib/supabase/`, `components/subscription/`) | [`docs/04-backend-integration.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/04-backend-integration.md) | Realtime channel names, data models, Stripe checkout modals, and session handling. |
| **Terms, Billing & Legal** (`app/terms/`) | [`docs/TERMS_AND_CONDITIONS.md`](file:///Users/goncaloforte/Sandbox/ScoreBoard/scoreboard-web/docs/TERMS_AND_CONDITIONS.md) | Pricing tiers, GDPR compliance, cancellation terms, user responsibility clauses. |

## 2. Diagram Standards
- When data structures or flow changes, update the relevant **Mermaid diagrams** (`flowchart TD`, `flowchart LR`, `sequenceDiagram`).
- Always quote special characters in labels: `id["Node (Details)"]`.

## 3. Commit Rule
- Include the updated documentation in the same git commit as the web code changes.
