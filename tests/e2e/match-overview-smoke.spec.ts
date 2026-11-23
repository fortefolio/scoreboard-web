import { test, expect } from "@playwright/test";

test.describe("Match Overview Regression Smoke Check", () => {
  test("renders Tennis completed sets and live game/point score on Match Overview", async ({ page }) => {
    const matchId = "smoke-tennis-1";

    await page.route("**/rest/v1/matches**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: matchId,
          sport_type: "Tennis",
          status: "ongoing",
          organizer_id: "org-1",
          tournament_id: null,
          participants: [{ name: "Carlos Alcaraz" }, { name: "Jannik Sinner" }],
          scores: {
            current: { home: 1, away: 0 },
            serving_index: 0,
            tennis: {
              sets: [{ home: 6, away: 0 }],
              games: [2, 1],
              points: [2, 1],
              current_set_games: [
                {
                  game_number: 1,
                  server: 0,
                  winner: 0,
                  is_break: false,
                  is_tiebreak: false,
                  games_after: { home: 1, away: 0 },
                  points_progression: ["15-0", "30-0", "40-0", "Game"],
                },
              ],
            },
          },
          settings: { max_sets: 3 },
          created_at: "2026-11-23T12:00:00Z",
        }),
      });
    });

    await page.route("**/rest/v1/match_events**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.route("**/rest/v1/users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "org-1", username: "gjoforte" }),
      });
    });

    await page.goto(`/match/${matchId}`, { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Carlos Alcaraz").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Jannik Sinner").first()).toBeVisible();
    await expect(page.getByText("30").first()).toBeVisible();
    await expect(page.getByText("15").first()).toBeVisible();
    await expect(page.getByText(/Set, Game & Point-by-Point Breakdown/i)).toBeVisible();
  });
});
