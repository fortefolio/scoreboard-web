import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FootballScoreboard from "@/app/match/[matchId]/scoreboard/FootballScoreboard";

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
 * FPF / Taça de Portugal — Jogo Oficial
 * Sporting CP vs Académico de Viseu
 * Regras: 2 partes x 45 min, cartões amarelos e vermelhos, cantos, faltas, compensação (+1m)
 */
const mockFootballMatch = {
  id: "fpf-sporting-viseu-match",
  sport_type: "Football",
  court: "Estádio José Alvalade — Lisboa",
  participants: [
    { name: "Sporting CP" },
    { name: "AC. Viseu" },
  ],
  scores: {
    goals: [0, 0],
    football: {
      goals: [0, 0],
      period: "1ª Parte",
      elapsed_seconds: 1500, // 25:00
      is_clock_running: true,
      stoppage_minutes: 0,
      yellow_cards: { home: 0, away: 0 },
      red_cards: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
    },
  },
  tournaments: { name: "Taça de Portugal 2026/27" },
};

describe("Football UI Interaction Tests — Official Match (Sporting CP vs AC. Viseu)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders participants, 'Futebol Oficial' badge, digital scores and 25:00 timer", () => {
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    expect(screen.getByText("Futebol Oficial")).toBeInTheDocument();
    expect(screen.getAllByText("Sporting CP")[0]).toBeInTheDocument();
    expect(screen.getAllByText("AC. Viseu")[0]).toBeInTheDocument();
    expect(screen.getByText("Taça de Portugal 2026/27")).toBeInTheDocument();
    expect(screen.getByText("25:00")).toBeInTheDocument();
    expect(screen.getAllByText("1ª Parte").length).toBeGreaterThan(0);
  });

  it("registers a goal (+1 Golo) and handles VAR goal cancellation (-1 Corrigir)", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    const goalBtns = screen.getAllByRole("button", { name: /\+1 Golo/i });
    const sportingGoalBtn = goalBtns[0];

    // Sporting scores at 26th minute
    await user.click(sportingGoalBtn);

    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          match_id: "fpf-sporting-viseu-match",
          event_data: { type: "goal", side: "home", period: "1ª Parte", minute: 26 },
        }),
      ])
    );

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          goals: [1, 0],
        }),
      })
    );

    // VAR cancels goal (-1 Corrigir)
    const undoBtns = screen.getAllByRole("button", { name: /-1 Corrigir/i });
    const undoHomeBtn = undoBtns[0];
    await user.click(undoHomeBtn);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          goals: [0, 0],
        }),
      })
    );
  });

  it("registers yellow and red disciplinary cards on the UI", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    const yellowBtns = screen.getAllByRole("button", { name: /Amarelo/i });
    const redBtns = screen.getAllByRole("button", { name: /Vermelho/i });

    // AC Viseu yellow card
    await user.click(yellowBtns[1]);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "card", card: "yellow", side: "away", period: "1ª Parte", minute: 26 },
        }),
      ])
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          football: expect.objectContaining({
            yellow_cards: { home: 0, away: 1 },
          }),
        }),
      })
    );

    // AC Viseu red card
    await user.click(redBtns[1]);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "card", card: "red", side: "away", period: "1ª Parte", minute: 26 },
        }),
      ])
    );
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

  it("registers match statistics (+ Canto and + Falta)", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    const cornerBtns = screen.getAllByRole("button", { name: /\+ Canto/i });
    const foulBtns = screen.getAllByRole("button", { name: /\+ Falta/i });

    // Corner for Sporting
    await user.click(cornerBtns[0]);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          football: expect.objectContaining({
            corners: { home: 1, away: 0 },
          }),
        }),
      })
    );

    // Foul for AC Viseu
    await user.click(foulBtns[1]);
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

  it("adjusts stoppage time (+1m) and displays '+1 MIN COMPENSAÇÃO' in digital badge", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    const stoppageBtn = screen.getByRole("button", { name: /\+1m/i });
    await user.click(stoppageBtn);

    expect(screen.getByText(/\+1 MIN COMPENSAÇÃO/i)).toBeInTheDocument();
  });

  it("changes match period to Intervalo (pausing clock) and then 2ª Parte (45:00)", async () => {
    const user = userEvent.setup();
    render(<FootballScoreboard matchData={mockFootballMatch} canEdit={true} />);

    // Select Intervalo
    const intervaloBtn = screen.getByRole("button", { name: "Intervalo" });
    await user.click(intervaloBtn);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          football: expect.objectContaining({
            period: "Intervalo",
            is_clock_running: false,
          }),
        }),
      })
    );

    // Select 2ª Parte
    const segundaParteBtn = screen.getByRole("button", { name: "2ª Parte" });
    await user.click(segundaParteBtn);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          football: expect.objectContaining({
            period: "2ª Parte",
            elapsed_seconds: 45 * 60,
          }),
        }),
      })
    );
  });
});
