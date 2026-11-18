import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import UmpireMatchesPage from "./page";

const pushMock = vi.fn();
const orMock = vi.fn();
let mockMatchesData: any[] = [];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: (filter: string) => {
              orMock(filter);
              return {
                order: () => Promise.resolve({ data: mockMatchesData, error: null }),
              };
            },
          }),
        }),
      }),
      channel: () => ({
        on: function () {
          return this;
        },
        subscribe: () => ({}),
      }),
      removeChannel: vi.fn(),
    },
  }),
}));

vi.mock("@/components/FollowButton", () => ({
  FollowButton: () => <button type="button" aria-label="Follow" />,
  SportFavoriteButton: () => <button type="button" aria-label="Sport Favorite" />,
}));

describe("UmpireMatchesPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    orMock.mockClear();
    mockMatchesData = [];
  });

  it("queries matches with NULL-safe organizer filter and renders empty state", async () => {
    render(
      <LanguageProvider>
        <UmpireMatchesPage />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/no assigned matches/i)).toBeInTheDocument();
    });
    expect(orMock).toHaveBeenCalledWith("organizer_id.is.null,organizer_id.neq.user-1");
  });

  it("renders assigned matches and navigates to scoreboard on Score Match click", async () => {
    const user = userEvent.setup();
    mockMatchesData = [
      {
        id: "m-99",
        tournament_id: "t-1",
        sport_type: "Volleyball",
        status: "scheduled",
        scheduled_at: "2026-11-20T12:00:00Z",
        participants: [{ name: "Team 7" }, { name: "Team 8" }],
        scores: { current: { home: 0, away: 0 } },
        tournaments: { name: "Torneio 4x4" },
        organizer: { username: "org_alice" },
      },
    ];

    render(
      <LanguageProvider>
        <UmpireMatchesPage />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Team 7").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("@org_alice")).toBeInTheDocument();

    await user.click(screen.getByTitle(/score match/i));
    expect(pushMock).toHaveBeenCalledWith("/match/m-99/scoreboard");
  });
});
