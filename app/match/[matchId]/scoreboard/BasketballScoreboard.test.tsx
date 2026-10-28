import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BasketballScoreboard from "./BasketballScoreboard";

const insertMock = vi.fn().mockResolvedValue({ error: null });
const updateMock = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: any) => insertMock(table, payload),
      update: (payload: any) => updateMock(payload),
    }),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

const mockBasketballMatch = {
  id: "match-bball-1",
  sport_type: "Basketball",
  participants: [
    { name: "Boston Celtics" },
    { name: "Miami Heat" },
  ],
  scores: {
    current: { home: 0, away: 0 },
    basketball: {
      period: "Q1",
      quarters: [
        { home: 0, away: 0 },
        { home: 0, away: 0 },
        { home: 0, away: 0 },
        { home: 0, away: 0 },
      ],
      fouls: { home: 0, away: 0 },
      timeouts: { home: 5, away: 5 },
    },
  },
  tournaments: { name: "NBA Playoffs" },
  court: "TD Garden",
};

describe("BasketballScoreboard Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders match participants, initial scores, quarters and clock", () => {
    render(<BasketballScoreboard matchData={mockBasketballMatch} canEdit={true} />);

    expect(screen.getAllByText("Boston Celtics")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Miami Heat")[0]).toBeInTheDocument();
    expect(screen.getByText("NBA Playoffs")).toBeInTheDocument();
    expect(screen.getByText("10:00")).toBeInTheDocument(); // Default FIBA clock
    expect(screen.getAllByText("24s")[0]).toBeInTheDocument(); // Shot clock
  });

  it("increments points with +1, +2, +3 buttons and sends point_scored event to Supabase", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockBasketballMatch} canEdit={true} />);

    // Find Home scoring buttons (+1, +2, +3)
    const homePlusTwo = screen.getAllByRole("button", { name: /\+2/i })[0];
    await user.click(homePlusTwo);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-bball-1",
            event_data: expect.objectContaining({
              type: "point_scored",
              side: "home",
              points: 2,
            }),
          }),
        ])
      );
    });

    // Score a 3-pointer for Away team
    const awayPlusThree = screen.getAllByRole("button", { name: /\+3/i })[1];
    await user.click(awayPlusThree);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-bball-1",
            event_data: expect.objectContaining({
              type: "point_scored",
              side: "away",
              points: 3,
            }),
          }),
        ])
      );
    });
  });

  it("switches periods and updates quarter context", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockBasketballMatch} canEdit={true} />);

    const q2Button = screen.getByRole("button", { name: /^Q2$/i });
    await user.click(q2Button);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });
  });

  it("increments team fouls and handles timeouts", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockBasketballMatch} canEdit={true} />);

    const addFoulButtons = screen.getAllByRole("button", { name: /\+ Falta/i });
    await user.click(addFoulButtons[0]); // Home foul

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    const timeoutButtons = screen.getAllByRole("button", { name: /Desconto/i });
    await user.click(timeoutButtons[0]); // Home timeout

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });
  });
});
