import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FootballScoreboard from "./FootballScoreboard";

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

const mockFootballMatch = {
  id: "match-football-1",
  sport_type: "Football",
  participants: [
    { name: "Sporting CP" },
    { name: "AC. Viseu" },
  ],
  scores: {
    current: { home: 0, away: 0 },
    football: {
      goals: [0, 0],
      period: "1ª Parte",
      elapsed_seconds: 0,
      is_clock_running: false,
      stoppage_minutes: 0,
      yellow_cards: { home: 0, away: 0 },
      red_cards: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
    },
  },
  tournaments: { name: "Taça de Portugal" },
  court: "Estádio José Alvalade",
};

describe("FootballScoreboard UI Interaction & Real Stats Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders teams, official badges, initial 0-0 digital score and clock", () => {
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    expect(screen.getAllByText("Sporting CP")[0]).toBeInTheDocument();
    expect(screen.getAllByText("AC. Viseu")[0]).toBeInTheDocument();
    expect(screen.getByText("Futebol Oficial")).toBeInTheDocument();
    expect(screen.getByText("Taça de Portugal")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("handles goals (+1 Golo) and score corrections (-1) with event dispatch", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    // Click +1 Golo for Sporting CP (Home)
    const homeGoalBtn = screen.getAllByRole("button", { name: /\+1 Golo/i })[0];
    await user.click(homeGoalBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-football-1",
            event_data: expect.objectContaining({
              type: "goal",
              side: "home",
            }),
          }),
        ])
      );
    });

    // Score a goal for AC Viseu (Away)
    const awayGoalBtn = screen.getAllByRole("button", { name: /\+1 Golo/i })[1];
    await user.click(awayGoalBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-football-1",
            event_data: expect.objectContaining({
              type: "goal",
              side: "away",
            }),
          }),
        ])
      );
    });

    // Click -1 Correction for Home
    const homeUndoBtn = screen.getAllByRole("button", { name: /-1 Corrigir/i })[0];
    await user.click(homeUndoBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });
  });

  it("registers discipline actions: Yellow Cards and Red Cards", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    // Add Yellow Card to Sporting CP
    const homeYellowBtn = screen.getAllByRole("button", { name: /^Amarelo$/i })[0];
    await user.click(homeYellowBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            football: expect.objectContaining({
              yellow_cards: { home: 1, away: 0 },
            }),
          }),
        })
      );
    });

    // Add Red Card to AC Viseu
    const awayRedBtn = screen.getAllByRole("button", { name: /^Vermelho$/i })[1];
    await user.click(awayRedBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            football: expect.objectContaining({
              red_cards: { home: 0, away: 1 },
            }),
          }),
        })
      );
    });
  });

  it("registers set piece and foul statistics (+ Canto and + Falta)", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    // Add Corner to Sporting CP
    const homeCornerBtn = screen.getAllByRole("button", { name: /\+ Canto/i })[0];
    await user.click(homeCornerBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            football: expect.objectContaining({
              corners: { home: 1, away: 0 },
            }),
          }),
        })
      );
    });

    // Add Foul to AC Viseu
    const awayFoulBtn = screen.getAllByRole("button", { name: /\+ Falta/i })[1];
    await user.click(awayFoulBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            football: expect.objectContaining({
              fouls: { home: 0, away: 1 },
            }),
          }),
        })
      );
    });
  });

  it("switches match periods and increments stoppage time (+1m)", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    // Switch to 2ª Parte
    const secondHalfBtn = screen.getByRole("button", { name: /^2ª Parte$/i });
    await user.click(secondHalfBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            football: expect.objectContaining({
              period: "2ª Parte",
              elapsed_seconds: 2700, // 45m
            }),
          }),
        })
      );
    });

    // Add stoppage time (+1m Compensação)
    const stoppageBtn = screen.getByRole("button", { name: /\+1m/i });
    await user.click(stoppageBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          scores: expect.objectContaining({
            football: expect.objectContaining({
              stoppage_minutes: 1,
            }),
          }),
        })
      );
    });
  });
});
