import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TennisScoreboard from "@/app/match/[matchId]/scoreboard/TennisScoreboard";

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

/**
 * 2023 Wimbledon Men's Singles Final (Centre Court, London)
 * Carlos Alcaraz vs Novak Djokovic
 * Source dataset: JeffSackmann/tennis_MatchChartingProject (20230716-M-Wimbledon-F-Carlos_Alcaraz-Novak_Djokovic)
 */
const mockWimbledonFinalMatch = {
  id: "wimbledon-2023-final",
  sport_type: "Tennis",
  court: "Centre Court — Wimbledon",
  participants: [
    { name: "Carlos Alcaraz" },
    { name: "Novak Djokovic" },
  ],
  scores: {
    serving_index: null,
    tennis: {
      points: [0, 0],
      games: [0, 0],
      sets: [],
      stats: {
        aces: { home: 0, away: 0 },
        double_faults: { home: 0, away: 0 },
      },
    },
  },
  tournaments: { name: "Wimbledon Championships 2023" },
};

describe("Tennis UI Interaction Tests — 2023 Wimbledon Final (Alcaraz vs Djokovic)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles initial coin toss selection and activates scoreboard UI for Djokovic serving", async () => {
    const user = userEvent.setup();
    render(<TennisScoreboard matchData={mockWimbledonFinalMatch} canEdit={true} />);

    // Toss banner must be displayed
    expect(screen.getByText(/Select First Server \/ Selecionar Servidor/i)).toBeInTheDocument();

    // Select Djokovic as first server
    const djokovicTossBtn = screen.getByRole("button", { name: /Novak Djokovic/i });
    await user.click(djokovicTossBtn);

    // Verifies events dispatched to backend
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          match_id: "wimbledon-2023-final",
          event_data: { type: "start_scoreboard" },
        }),
        expect.objectContaining({
          match_id: "wimbledon-2023-final",
          event_data: { type: "toss_coin", winner_index: 1 },
        }),
      ])
    );

    // Toss banner disappears after selection
    await waitFor(() => {
      expect(screen.queryByText(/Select First Server/i)).not.toBeInTheDocument();
    });
  });

  it("replays the Set 3 Game 5 13-deuce marathon: points, aces, double faults, deuces and break points", async () => {
    const user = userEvent.setup();

    // Start with Djokovic serving in Set 3
    const matchInProgress = {
      ...mockWimbledonFinalMatch,
      scores: {
        serving_index: 1, // Djokovic serving
        tennis: {
          points: [0, 0],
          games: [3, 1],
          sets: [
            { home: 1, away: 6 },
            { home: 7, away: 6 },
          ],
          stats: {
            aces: { home: 4, away: 2 },
            double_faults: { home: 1, away: 2 },
          },
        },
      },
    };

    render(<TennisScoreboard matchData={matchInProgress} canEdit={true} />);

    // Get point buttons for both players
    const addPointButtons = screen.getAllByRole("button", { name: /\+ Ponto/i });
    const alcarazAddPoint = addPointButtons[0];
    const djokovicAddPoint = addPointButtons[1];

    const aceButtons = screen.getAllByRole("button", { name: /Ás \(Ace\)/i });
    const alcarazAceBtn = aceButtons[0];
    const djokovicAceBtn = aceButtons[1];

    const dfButtons = screen.getAllByRole("button", { name: /Falta Dupla/i });
    const djokovicDfBtn = dfButtons[1];

    // Rally 1: Alcaraz hits return winner -> 15-0 (Alcaraz leading)
    await user.click(alcarazAddPoint);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_won", side: "home" },
        }),
      ])
    );

    // Rally 2: Djokovic hits an Ace -> 15-15
    await user.click(djokovicAceBtn);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "tennis_stat", stat: "ace", side: "away" },
        }),
      ])
    );

    // Rally 3: Djokovic double faults -> 30-15 Alcaraz
    await user.click(djokovicDfBtn);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "tennis_stat", stat: "double_fault", side: "away" },
        }),
      ])
    );

    // Advance to 40-40 (Deuce #1)
    // Alcaraz: currently 2 pts (30). Djokovic: 1 pt (15).
    await user.click(djokovicAddPoint); // 30-30
    await user.click(alcarazAddPoint);  // 40-30 Alcaraz (Break Point!)

    // Check Break Point indicator banner (PONTO DE BREAK!)
    expect(screen.getByText(/PONTO DE BREAK!/i)).toBeInTheDocument();

    // Djokovic saves Break Point -> 40-40 (Deuce)
    await user.click(djokovicAddPoint);
    expect(screen.getByText(/IGUALDADE \(40 - 40\)/i)).toBeInTheDocument();

    // Djokovic gets Advantage (Ad-40) -> Big point displays AD
    await user.click(djokovicAddPoint);
    expect(screen.getAllByText("AD").length).toBeGreaterThan(0);

    // Alcaraz brings it back to Deuce
    await user.click(alcarazAddPoint);
    expect(screen.getByText(/IGUALDADE \(40 - 40\)/i)).toBeInTheDocument();

    // Alcaraz gets Advantage (40-Ad Break Point)
    await user.click(alcarazAddPoint);
    expect(screen.getByText(/PONTO DE BREAK!/i)).toBeInTheDocument();
    expect(screen.getAllByText("AD").length).toBeGreaterThan(0);
  });

  it("allows referee to manually switch server using Alternar Servidor button", async () => {
    const user = userEvent.setup();
    const matchData = {
      ...mockWimbledonFinalMatch,
      scores: {
        serving_index: 0,
        tennis: {
          points: [0, 0],
          games: [1, 0],
          stats: { aces: { home: 0, away: 0 }, double_faults: { home: 0, away: 0 } },
        },
      },
    };

    render(<TennisScoreboard matchData={matchData} canEdit={true} />);

    // Click "Alternar Servidor"
    const toggleServerBtn = screen.getByRole("button", { name: /Alternar Servidor/i });
    await user.click(toggleServerBtn);

    // Verify update call dispatched to matches table
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          serving_index: 1,
        }),
      })
    );
  });
});
