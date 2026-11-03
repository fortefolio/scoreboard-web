import { test, expect } from "@playwright/test";

test.describe("Broadcast Scoreboard Overlay E2E", () => {
  test("renders overlay without hydration errors or runtime crashes", async ({ page }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (error) => {
      pageErrors.push(error);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const matchId = "71d69be5-7caa-4684-80dc-203681925047";
    await page.goto(`/match/${matchId}/overlay?pos=top&scale=md`, {
      waitUntil: "networkidle",
    });

    // Check that players/teams are rendered
    await expect(page.getByText(/A\. COELLO \/ A\. TAPIA/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/A\. GALÁN \/ F\. CHINGOTTO/i)).toBeVisible({ timeout: 10_000 });

    // Check that sport badge is rendered
    await expect(page.getByText(/Padel/i)).toBeVisible();

    // Check that games score is rendered
    await expect(page.getByText("1")).toBeVisible();

    // Check that there were no page crashes
    expect(pageErrors).toEqual([]);

    // Check that no fatal hydration error occurred
    const hydrationErrors = consoleErrors.filter((msg) =>
      msg.toLowerCase().includes("hydration failed")
    );
    expect(hydrationErrors).toEqual([]);

    // Take screenshot to visually inspect
    await page.screenshot({ path: "test-results/overlay-screenshot.png" });
  });

  test("renders overlay with bottom position and lg scale correctly", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const matchId = "71d69be5-7caa-4684-80dc-203681925047";
    await page.goto(`/match/${matchId}/overlay?pos=bottom&scale=lg`, {
      waitUntil: "networkidle",
    });

    await expect(page.getByText(/A\. COELLO \/ A\. TAPIA/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Padel/i)).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("renders scoreboard page with Material Symbols icons properly loaded", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const matchId = "71d69be5-7caa-4684-80dc-203681925047";
    await page.goto(`/match/${matchId}/scoreboard`, {
      waitUntil: "networkidle",
    });

    // Wait for the scoreboard and action elements
    await expect(page.getByText(/A\. COELLO \/ A\. TAPIA/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/A\. GALÁN \/ F\. CHINGOTTO/i).first()).toBeVisible({ timeout: 10_000 });

    // Verify Material Symbols font is loaded and icons have class material-symbols-outlined
    const iconElements = page.locator(".material-symbols-outlined");
    await expect(iconElements.first()).toBeVisible();

    expect(pageErrors).toEqual([]);

    await page.screenshot({ path: "test-results/scoreboard-icons-verification.png" });
  });
});
