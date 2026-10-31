import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TennisScoreboard from "./TennisScoreboard";

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

const mockMatchData = {
  id: "match-123",
  sport_type: "Tennis",
  participants: [
    { name: "Roger Federer" },
    { name: "Rafael Nadal" }
  ],
  scores: {
    serving_index: null,
    tennis: {
      points: [0, 0],
      games: [0, 0],
      stats: {
        aces: { home: 0, away: 0 },
        double_faults: { home: 0, away: 0 },
      },
    }
  },
  tournaments: { name: "Wimbledon" },
  court: "Centre Court"
};

describe("TennisScoreboard UI Interaction & Real Stats Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends both start_scoreboard and toss_coin events when a server is selected", async () => {
    const user = userEvent.setup();
    render(<TennisScoreboard matchData={mockMatchData} canEdit={true} />);

    // Check if the toss banner is visible
    expect(screen.getByText(/Select First Server/i)).toBeInTheDocument();

    // Click on the first player to set as server
    const federerButton = screen.getByRole("button", { name: /Roger Federer/i });
    await user.click(federerButton);

    // Verify Supabase calls
    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
      
      const call = insertMock.mock.calls[0];
      const table = call[0];
      const payload = call[1];
      
      expect(table).toBe("match_events");
      expect(payload).toEqual([
        {
          match_id: "match-123",
          event_data: { type: "start_scoreboard" }
        },
        {
          match_id: "match-123",
          event_data: { 
            type: "toss_coin", 
            winner_index: 0 
          }
        }
      ]);
    });
  });

  it("updates the UI optimistically when a server is selected", async () => {
    const user = userEvent.setup();
    render(<TennisScoreboard matchData={mockMatchData} canEdit={true} />);

    const nadalButton = screen.getByRole("button", { name: /Rafael Nadal/i });
    await user.click(nadalButton);

    // Banner should disappear and Nadal should show as serving
    await waitFor(() => {
      expect(screen.queryByText(/Select First Server/i)).not.toBeInTheDocument();
      const nadalElements = screen.getAllByText("Rafael Nadal");
      const nadalSection = nadalElements.find(el => el.closest("div")?.parentElement?.textContent?.includes("Serving"))?.closest("div")?.parentElement;
      expect(nadalSection).toHaveTextContent(/Serving/i);
    });
  });

  it("scores points with + Ponto and sends point_won events", async () => {
    const user = userEvent.setup();
    const readyMatch = {
      ...mockMatchData,
      scores: {
        ...mockMatchData.scores,
        serving_index: 0,
      },
    };

    render(<TennisScoreboard matchData={readyMatch} canEdit={true} />);

    // Click + Ponto for Federer (Home)
    const homePointBtn = screen.getAllByRole("button", { name: /\+ Ponto/i })[0];
    await user.click(homePointBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-123",
            event_data: expect.objectContaining({
              type: "point_won",
              side: "home",
            }),
          }),
        ])
      );
    });

    // Score for Nadal (Away)
    const awayPointBtn = screen.getAllByRole("button", { name: /\+ Ponto/i })[1];
    await user.click(awayPointBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-123",
            event_data: expect.objectContaining({
              type: "point_won",
              side: "away",
            }),
          }),
        ])
      );
    });
  });

  it("records Ace (Ás) and Double Fault (Falta Dupla) actions with statistical events", async () => {
    const user = userEvent.setup();
    const readyMatch = {
      ...mockMatchData,
      scores: {
        ...mockMatchData.scores,
        serving_index: 0, // Federer is serving
      },
    };

    render(<TennisScoreboard matchData={readyMatch} canEdit={true} />);

    // Federer serves an Ace
    const aceBtn = screen.getAllByRole("button", { name: /Ás \(Ace\)/i })[0];
    await user.click(aceBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-123",
            event_data: expect.objectContaining({
              type: "tennis_stat",
              stat: "ace",
              side: "home",
            }),
          }),
        ])
      );
    });

    // Federer commits a Double Fault (opposing player gets the point)
    const doubleFaultBtn = screen.getAllByRole("button", { name: /Falta Dupla/i })[0];
    await user.click(doubleFaultBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-123",
            event_data: expect.objectContaining({
              type: "tennis_stat",
              stat: "double_fault",
              side: "home",
            }),
          }),
        ])
      );
    });
  });

  it("toggles server rotation and adjusts deuce/ad court sides", async () => {
    const user = userEvent.setup();
    const readyMatch = {
      ...mockMatchData,
      scores: {
        ...mockMatchData.scores,
        serving_index: 0,
      },
    };

    render(<TennisScoreboard matchData={readyMatch} canEdit={true} />);

    const toggleServerBtn = screen.getByRole("button", { name: /Alternar Servidor/i });
    await user.click(toggleServerBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            serving_index: 1,
          }),
        })
      );
    });
  });
});
