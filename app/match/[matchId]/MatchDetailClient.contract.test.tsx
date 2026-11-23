import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MatchDetailClient from "./MatchDetailClient";
import {
  createInitialTennisScores,
  calculateTennisScore,
} from "@/lib/scoring/tennis-engine";
import type { MatchScores } from "@/lib/scoring/types";

let mockMatchData: any = null;
let mockEventsData: any[] = [];

vi.mock("next/navigation", () => ({
  useParams: () => ({ matchId: "contract-web-1" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/i18n", async () => {
  const en = await import("@/lib/i18n/locales/en");
  return {
    useTranslation: () => ({
      locale: "en",
      t: (key: string) => {
        const parts = key.split(".");
        let cur: any = (en as any).en || (en as any).default || en;
        for (const p of parts) cur = cur?.[p];
        return typeof cur === "string" ? cur : key;
      },
    }),
  };
});

const { mockSupabaseClient } = vi.hoisted(() => {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "org-1" } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "matches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: mockMatchData, error: null }),
            })),
          })),
        };
      }
      if (table === "match_events") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: mockEventsData, error: null }),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      };
    }),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    })),
    removeChannel: vi.fn(),
  };
  return { mockSupabaseClient: client };
});

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "org-1" },
    supabase: mockSupabaseClient,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: mockSupabaseClient,
  getSupabaseBrowserClient: () => mockSupabaseClient,
}));

vi.mock("@/components/FollowButton", () => ({
  FollowButton: () => null,
  SportFavoriteButton: () => null,
}));

vi.mock("@/components/match/MatchAtmosphereBackground", () => ({
  default: () => null,
  MatchAtmosphereBackground: () => null,
}));

vi.mock("@/components/RuleModal", () => ({
  default: () => null,
}));

vi.mock("@/components/subscription/UpgradeModal", () => ({
  default: () => null,
}));

describe("Web MatchDetailClient Contract Tests", () => {
  beforeEach(() => {
    mockMatchData = null;
    mockEventsData = [];
  });

  it("renders real calculateTennisScore output (completed set 6-0 + live 30-15)", async () => {
    let state = createInitialTennisScores(0);
    for (let i = 0; i < 24; i++) {
      state = calculateTennisScore(state, 0, { max_sets: 3 });
    }
    state = calculateTennisScore(state, 0, { max_sets: 3 });
    state = calculateTennisScore(state, 0, { max_sets: 3 });
    state = calculateTennisScore(state, 1, { max_sets: 3 });

    const typedScores: MatchScores = state;

    mockMatchData = {
      id: "contract-web-1",
      sport_type: "Tennis",
      status: "ongoing",
      organizer_id: "org-1",
      tournament_id: null,
      participants: [{ name: "Carlos Alcaraz" }, { name: "Jannik Sinner" }],
      scores: typedScores,
      settings: { max_sets: 3 },
    };

    render(<MatchDetailClient />);

    await waitFor(() => {
      expect(screen.getByText("6")).toBeInTheDocument();
    });
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("reconciles Football goal + correct_goal events in Score Progress", async () => {
    mockMatchData = {
      id: "contract-web-1",
      sport_type: "Football",
      status: "ongoing",
      organizer_id: "org-1",
      tournament_id: null,
      participants: [{ name: "AAC" }, { name: "AAV" }],
      scores: { current: { home: 1, away: 0 }, football: { goals: { home: 1, away: 0 } } },
      settings: {},
    };
    mockEventsData = [
      { id: "e1", created_at: "2026-11-23T15:00:00Z", event_data: { type: "goal", side: "home", minute: 1 } },
      { id: "e2", created_at: "2026-11-23T15:01:00Z", event_data: { type: "goal", side: "away", minute: 2 } },
      { id: "e3", created_at: "2026-11-23T15:02:00Z", event_data: { type: "correct_goal", side: "away" } },
    ];

    render(<MatchDetailClient />);

    await waitFor(() => {
      expect(screen.getByText("1 goal recorded")).toBeInTheDocument();
    });
    expect(screen.getByText("1'")).toBeInTheDocument();
    expect(screen.queryByText("2'")).not.toBeInTheDocument();
  });
});
