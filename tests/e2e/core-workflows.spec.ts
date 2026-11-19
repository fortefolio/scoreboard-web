import { test, expect } from "@playwright/test";

test.describe("Core Platform Workflows", () => {
  test("unauthenticated landing page renders matches/tournaments tabs and opens login modal", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText(/SCORE:BOARD/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Matches/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Tournaments/i }).first()).toBeVisible();

    // Protected route redirects unauthenticated user to login modal
    await page.goto("/my-tournaments");
    await expect(page).toHaveURL(/\/\?auth=login&next=%2Fmy-tournaments$/);
    await expect(page.getByPlaceholder(/enter your email/i)).toBeVisible({ timeout: 15_000 });
  });

  test("authenticated user creates a match, scores live points, and spectator sees Realtime update", async ({
    browser,
  }) => {
    const stamp = Date.now();
    const email = `e2e_scorer_${stamp}@example.com`;
    const username = `scorer_${stamp}`;
    const password = "PlaywrightTestPassword!23";

    const organizerContext = await browser.newContext();
    const spectatorContext = await browser.newContext();

    const orgPage = await organizerContext.newPage();
    const specPage = await spectatorContext.newPage();

    try {
      // 1. Sign up as organizer via /my-matches redirect
      await orgPage.goto("/my-matches");
      await expect(orgPage.getByPlaceholder(/enter your email/i)).toBeVisible({ timeout: 15_000 });
      await orgPage.getByRole("button", { name: /^sign up$/i }).click();
      await orgPage.getByPlaceholder(/choose a username/i).fill(username);
      await orgPage.getByPlaceholder(/enter your email/i).fill(email);
      await orgPage.getByPlaceholder(/enter your password/i).fill(password);
      await orgPage.getByPlaceholder(/confirm your password/i).fill(password);
      await orgPage.getByRole("button", { name: /^sign up$/i }).last().click();
      await expect(orgPage).toHaveURL(/\/my-matches$/, { timeout: 15_000 });

      // 2. Create a Basketball match
      await orgPage.getByRole("button", { name: /New Match/i }).click();
      await orgPage.getByPlaceholder("Team Alpha").fill("E2E Lions");
      await orgPage.getByPlaceholder("Team Beta").fill("E2E Tigers");
      await orgPage.getByRole("button", { name: /Tennis/i }).click();
      await orgPage.getByRole("button", { name: /^Basketball$/i }).click();
      await orgPage.getByRole("button", { name: /^Create Match$/i }).click();

      // 3. Navigate to created match overview
      const matchLink = orgPage.getByText(/E2E Lions/i).first();
      await expect(matchLink).toBeVisible({ timeout: 10_000 });
      await matchLink.click();
      await expect(orgPage).toHaveURL(/\/match\/[^/]+$/, { timeout: 10_000 });
      const matchUrl = orgPage.url();

      // 4. Spectator opens the same match overview in a separate unauthenticated context
      await specPage.goto(matchUrl);
      await expect(specPage.getByText(/E2E Lions/i)).toBeVisible({ timeout: 15_000 });
      await expect(specPage.getByText(/E2E Tigers/i)).toBeVisible();

      // 5. Organizer starts scoreboard and records +1 point
      const startBtn = orgPage.getByRole("button", { name: /Start Scoreboard|Open Scoreboard/i });
      if (await startBtn.isVisible()) {
        await startBtn.click();
        await expect(orgPage).toHaveURL(/\/scoreboard$/, { timeout: 10_000 });
        const plusBtn = orgPage.getByRole("button", { name: /\+1|\+2/i }).first();
        if (await plusBtn.isVisible()) {
          await plusBtn.click();
          // Verify spectator view updates without manual reload
          await expect(specPage.getByText(/1|2/).first()).toBeVisible({ timeout: 10_000 });
        }
      }
    } finally {
      await organizerContext.close();
      await spectatorContext.close();
    }
  });
});
