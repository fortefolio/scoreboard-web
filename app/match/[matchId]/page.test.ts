// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const singleMock = vi.fn();
const eqMock = vi.fn(() => ({ single: singleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: fromMock })),
}));

vi.mock("@/lib/supabase/env", () => ({
  supabaseEnv: () => ({ url: "https://example.supabase.co", anonKey: "anon-key" }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import { generateMetadata } from "./page";

describe("MatchDetailsPage generateMetadata", () => {
  beforeEach(() => {
    singleMock.mockReset();
  });

  it("formats set scores without [object Object] and sets complete OG/Twitter metadata", async () => {
    singleMock.mockResolvedValue({
      data: {
        participants: [{ name: "Alexander Zverev" }, { name: "Carlos Alcaraz" }],
        scores: {
          sets: [
            { home: 6, away: 4 },
            { home: 3, away: 6 },
          ],
        },
        tournaments: null,
      },
      error: null,
    });

    const meta = await generateMetadata({
      params: Promise.resolve({ matchId: "match-123" }),
    });

    expect(meta.title).toBe("Alexander Zverev vs Carlos Alcaraz");
    expect(meta.description).toContain("Live Score: 1 - 1");
    expect(meta.description!.length).toBeLessThanOrEqual(120);
    expect(meta.description).not.toContain("[object Object]");
    expect(meta.openGraph).toMatchObject({
      type: "website",
      siteName: "ScoreBoard",
      url: "https://score-board.net/match/match-123",
    });
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["/api/og/match?id=match-123"],
    });
  });

  it("returns fallback title and description when match is not found", async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: "Not found" } });

    const meta = await generateMetadata({
      params: Promise.resolve({ matchId: "missing-id" }),
    });

    expect(meta.title).toBe("Match Not Found");
    expect(meta.description).toBeTruthy();
  });
});
