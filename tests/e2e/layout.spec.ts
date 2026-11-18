import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

for (const vp of VIEWPORTS) {
  test(`guest landing layout has no horizontal overflow on ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/technical capabilities/i)).toBeVisible();

    // Guest landing should not show bottom tab bar or + New Match CTA
    await expect(page.locator("nav[aria-label='Mobile navigation']")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /new match/i })).toHaveCount(0);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}

test("terms page fits mobile viewport without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/terms");

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});
