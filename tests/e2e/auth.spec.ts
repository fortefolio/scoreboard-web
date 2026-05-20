import { test, expect } from "@playwright/test";

/**
 * Smoke path: guest hits a protected route → redirected → signs up → lands
 * on the originally-requested page. Exercises middleware redirect, cookie
 * session, AuthProvider hydration, and the signup modal.
 */
test("guest is redirected from /my-matches, signs up, lands back on /my-matches", async ({ page }) => {
  // Unique email per run so the local Supabase auth table doesn't reject as duplicate.
  const stamp = Date.now();
  const email = `e2e+${stamp}@example.com`;
  const username = `e2e_${stamp}`;
  const password = "PlaywrightTestPassword!23";

  // 1. Guest visits a protected page directly.
  await page.goto("/my-matches");

  // 2. Middleware should redirect to /?auth=login&next=/my-matches.
  await expect(page).toHaveURL(/\/\?auth=login&next=%2Fmy-matches$/);
  // The modal opens via a client useEffect that reads searchParams; allow
  // a generous window for hydration on first run with Cache Components.
  await expect(page.getByPlaceholder(/enter your email/i)).toBeVisible({ timeout: 15_000 });

  // 3. Switch the login modal to signup via the footer toggle.
  await page.getByRole("button", { name: /^sign up$/i }).click();
  await expect(page.getByPlaceholder(/choose a username/i)).toBeVisible();

  // 4. Fill the signup form.
  await page.getByPlaceholder(/choose a username/i).fill(username);
  await page.getByPlaceholder(/enter your email/i).fill(email);
  await page.getByPlaceholder(/enter your password/i).fill(password);
  await page.getByPlaceholder(/confirm your password/i).fill(password);

  // 5. Submit and verify we land on /my-matches.
  await page.getByRole("button", { name: /^sign up$/i }).last().click();

  // Auto-confirm email is on by default in `supabase start`, so signup yields
  // an immediate session and the post-login next=/my-matches push fires.
  await expect(page).toHaveURL(/\/my-matches$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /my/i, level: 1 })).toBeVisible();
});
