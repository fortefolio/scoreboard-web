// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse extends Response {
    constructor(_element: unknown, init?: { headers?: Record<string, string> }) {
      super("mock-png", {
        status: 200,
        headers: {
          "content-type": "image/png",
          ...(init?.headers ?? {}),
        },
      });
    }
  },
}));

import { GET } from "./route";

describe("GET /api/og/match", () => {
  beforeEach(() => {
    singleMock.mockReset();
  });

  it("returns a 200 PNG with public cache headers for a valid match", async () => {
    singleMock.mockResolvedValue({
      data: {
        participants: [{ name: "Benfica" }, { name: "Porto" }],
        scores: { current: { home: 2, away: 1 } },
        sport_type: "Football",
        status: "ongoing",
        tournaments: { name: "Cup Final" },
      },
      error: null,
    });

    const req = new NextRequest("https://score-board.net/api/og/match?id=match-1");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=60");
  });

  it("falls back cleanly when id query param is omitted", async () => {
    const req = new NextRequest("https://score-board.net/api/og/match");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(singleMock).not.toHaveBeenCalled();
  });
});
