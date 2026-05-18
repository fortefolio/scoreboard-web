# Design System Documentation: The Kinetic Vault

## 1. Overview & Creative North Star: "The Kinetic Vault"
This design system is engineered for high-velocity sports analytics. The Creative North Star is **"The Kinetic Vault"**—a space that feels like an elite, high-performance command center. We are moving away from the "generic dashboard" look. Instead of a flat grid of widgets, we treat the UI as a deep, atmospheric environment where data isn't just displayed; it is showcased.

To break the "template" feel, we utilize **Intentional Asymmetry**. Large-scale typography (Display-LG) should overlap container edges, and data visualizations should bleed into the background gradients. We avoid rigid boxes in favor of layered surfaces that suggest a physical depth of information.

---

## 2. Colors & Chromatic Depth
The palette is rooted in a deep slate-black foundation, utilizing Indigo as a surgical accent to guide the eye toward "Winning" actions and critical data points.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders for sectioning or layout containment. Boundaries must be defined solely through background color shifts.
*   Use `surface-container-low` for secondary sections sitting on a `surface` background.
*   Use `surface-container-highest` for the most critical interactive elements.
*   Separation is achieved through *tonal contrast*, not structural lines.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked sheets of fine, dark glass. 
*   **Base:** `surface` (#0c1324)
*   **Level 1 (Sections):** `surface-container-low` (#151b2d)
*   **Level 2 (Cards):** `surface-container` (#191f31)
*   **Level 3 (Popovers/Modals):** `surface-container-high` (#23293c)

### The "Glass & Gradient" Rule
To achieve a "High-Performance" feel, primary interactive components should utilize a **Glassmorphism effect**. Apply `primary-container` (#4f46e5) with a 60-80% opacity and a `backdrop-blur` (12px to 20px). This ensures the UI feels integrated into the dark atmosphere rather than floating awkwardly on top of it.

---

## 3. Typography: Editorial Precision
This system uses a dual-personality typographic approach to balance human-centric editorial content with cold, hard statistical data.

*   **Headlines & Branding (Manrope):** Used for headers and display. Its geometric nature provides a premium, "Editorial" feel. Use `display-lg` for hero stats to create a sense of scale.
*   **Reading & Interface (Inter):** Used for body copy and general UI navigation. It provides the neutral clarity required for dense analytics.
*   **Performance Data (Space Grotesk):** This is our "High-Performance" font. All scores, timers, and data tables must use Space Grotesk. Its wide, technical stance communicates precision and real-time accuracy.

---

## 4. Elevation & Depth: Tonal Layering
We do not use shadows to simulate height; we use light. 

*   **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card placed on a `surface-container-low` section creates a natural "sunken" effect, perfect for data input or secondary logs.
*   **Ambient Shadows:** When a floating modal is required, use an extra-diffused shadow (Blur: 40px) with 6% opacity. The shadow color should be a deep Indigo tint rather than pure black to maintain "visual soul."
*   **The "Ghost Border" Fallback:** If a border is required for accessibility in data-dense tables, use `outline-variant` (#464555) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Use `surface-bright` (#33394c) at 40% opacity with a blur for top-level navigation bars to allow the motion of scores scrolling underneath to be subtly visible.

---

## 5. Components

### High-Visibility Buttons
*   **Primary:** Indigo `primary-container` (#4f46e5). Use `xl` (0.75rem) roundedness. Add a subtle outer glow using the `surface-tint` color at 10% opacity for a "powered-on" effect.
*   **Secondary:** Glass-style. Transparent background with a `Ghost Border` and `on-surface` text.

### Data Tables & Analytics
*   **Strict Rule:** Forbid the use of horizontal or vertical divider lines. 
*   **Solution:** Use the `2` (0.4rem) or `3` (0.6rem) spacing scale to create gutters. Use alternating row colors from `surface-container-low` to `surface-container` for readability. 

### Bracket Trees
Nodes should be `surface-container-high` blocks. Connecting lines must be `outline-variant` at 20% opacity. Winning paths should be highlighted with a `secondary` (#4edea3) 2px glow line to indicate the "Golden Path."

### Social & Athlete Cards
Use **Asymmetric Layouts**. Place the athlete’s name (Headline-MD) overlapping a large, low-opacity Space Grotesk number in the background. Use `surface-container-highest` for the card base to make it pop against the deep slate background.

### Status Chips
*   **Win:** `secondary-container` (#00a572) with `on-secondary-container` text.
*   **Loss/Cap:** `error-container` (#93000a) with `on-error-container` text.
*   Chips should always use the `full` (9999px) roundedness scale for a distinct "pill" shape that contrasts with the more angular card system.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `display-lg` for scores. Make them massive. Data is the hero.
*   **Do** use the Spacing Scale (especially `10` and `12`) to give sections "room to breathe." High-end design is defined by white space (or in this case, "dark space").
*   **Do** use `tertiary` (#ffb690) for "Point Caps" or "Critical Alerts" to provide a warm contrast to the cool Indigo/Slate theme.

### Don’t:
*   **Don’t** use pure white (#FFFFFF) for text. Use `on-surface` (#dce1fb) to reduce eye strain in deep dark mode.
*   **Don’t** use standard 1px borders. If you find yourself reaching for a border, use a background color shift instead.
*   **Don’t** use bright, saturated red for losses. Use the sophisticated `error_container` (#93000a) to maintain the premium, muted aesthetic.
