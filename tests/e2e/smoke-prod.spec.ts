import { test, expect } from "@playwright/test";

/**
 * Production / post-deploy smoke test.
 * Verifies pages return 200, hydrate cleanly in Chromium, and have zero
 * CSP violations (`securitypolicyviolation`) or uncaught JS runtime errors.
 *
 * Usage:
 *   PLAYWRIGHT_BASE_URL=https://score-board.net npm run test:smoke
 *   PLAYWRIGHT_SERVER_CMD="npm run build && npm run start" npm run test:smoke
 */
test.describe("Production Hydration & CSP Smoke Check", () => {
  for (const route of ["/", "/terms"]) {
    test(`route ${route} loads, hydrates, and has zero CSP or runtime errors`, async ({ page }) => {
      const cspViolations: string[] = [];
      const pageErrors: string[] = [];

      await page.addInitScript(() => {
        (window as any).__cspViolations = [];
        document.addEventListener("securitypolicyviolation", (e: SecurityPolicyViolationEvent) => {
          (window as any).__cspViolations.push(
            `${e.violatedDirective} blocked ${e.blockedURI || "inline"}`
          );
        });
      });

      page.on("pageerror", (err) => {
        pageErrors.push(err.message);
      });

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);

      // Wait for React/Next hydration
      await expect(page.getByText(/SCORE:BOARD/i).first()).toBeVisible({ timeout: 15_000 });

      if (route === "/") {
        const tournamentsLink = page.getByRole("link", { name: /Tournaments/i }).first();
        await expect(tournamentsLink).toBeVisible();
        // Clicking Get Started verifies client JS event handlers actually hydrated
        const getStartedBtn = page.getByRole("button", { name: /Get Started/i }).first();
        await expect(getStartedBtn).toBeVisible();
        await getStartedBtn.click();
        await expect(page.getByPlaceholder(/enter your email/i)).toBeVisible({ timeout: 5_000 });
      }

      const recordedCsp = await page.evaluate(() => (window as any).__cspViolations || []);
      cspViolations.push(...recordedCsp);

      expect(cspViolations, `CSP violations on ${route}`).toEqual([]);
      expect(pageErrors, `Runtime page errors on ${route}`).toEqual([]);
    });
  }
});
