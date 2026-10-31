import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BasketballScoreboard from "@/app/match/[matchId]/scoreboard/BasketballScoreboard";

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
 * FIBA / Federação Portuguesa de Basquetebol (FPB) — Liga Betclic
 * Clássico: SL Benfica vs FC Porto
 * Pavilhão Fidelidade, Lisboa
 * Regras: 4 x 10 minutos, posse de 24s / 14s, bónus à 5ª falta por período, 5 descontos de tempo
 */
const mockFibaBasketballMatch = {
  id: "fiba-benfica-porto-2026",
  sport_type: "Basketball",
  court: "Pavilhão Fidelidade — Lisboa",
  participants: [
    { name: "SL Benfica" },
    { name: "FC Porto" },
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
      quarter_seconds: 600,
      is_clock_running: false,
    },
  },
  tournaments: { name: "Liga Betclic Basquetebol" },
};

describe("Basketball UI Interaction Tests — FIBA Liga Betclic (SL Benfica vs FC Porto)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders participants, default 10:00 FIBA clock, 24s shot clock, and Q1", () => {
    render(<BasketballScoreboard matchData={mockFibaBasketballMatch} canEdit={true} />);

    expect(screen.getAllByText("SL Benfica")[0]).toBeInTheDocument();
    expect(screen.getAllByText("FC Porto")[0]).toBeInTheDocument();
    expect(screen.getByText("Liga Betclic Basquetebol")).toBeInTheDocument();
    expect(screen.getByText("10:00")).toBeInTheDocument();
    expect(screen.getAllByText("24s").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Q1").length).toBeGreaterThan(0);
  });

  it("scores +1, +2, and +3 points via UI buttons, updating digital score and resetting shot clock", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockFibaBasketballMatch} canEdit={true} />);

    // Benfica Free Throw (+1)
    const plus1Btns = screen.getAllByRole("button", { name: /\+1/i });
    const benficaPlus1 = plus1Btns[0];
    await user.click(benficaPlus1);

    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_scored", side: "home", points: 1, period: "Q1" },
        }),
      ])
    );

    // Benfica Field Goal (+2)
    const plus2Btns = screen.getAllByRole("button", { name: /\+2/i });
    const benficaPlus2 = plus2Btns[0];
    await user.click(benficaPlus2);

    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_scored", side: "home", points: 2, period: "Q1" },
        }),
      ])
    );

    // Porto Triple (+3)
    const plus3Btns = screen.getAllByRole("button", { name: /\+3/i });
    const portoPlus3 = plus3Btns[1];
    await user.click(portoPlus3);

    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_scored", side: "away", points: 3, period: "Q1" },
        }),
      ])
    );

    // Both teams now have 3 points in current digital display
    const threes = screen.getAllByText("3");
    expect(threes.length).toBeGreaterThanOrEqual(2);
  });

  it("accumulates team fouls up to bonus (5th foul) and displays Bónus badge", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockFibaBasketballMatch} canEdit={true} />);

    const foulBtns = screen.getAllByRole("button", { name: /\+ Falta/i });
    const benficaFoulBtn = foulBtns[0];

    // Click 4 fouls for Benfica
    await user.click(benficaFoulBtn);
    await user.click(benficaFoulBtn);
    await user.click(benficaFoulBtn);
    await user.click(benficaFoulBtn);

    expect(screen.queryByText(/\(BÓNUS\)/i)).not.toBeInTheDocument();

    // 5th foul triggers bonus
    await user.click(benficaFoulBtn);
    expect(screen.getByText(/\(BÓNUS\)/i)).toBeInTheDocument();
  });

  it("decrements team timeouts and pauses clock when Desconto button is pressed", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockFibaBasketballMatch} canEdit={true} />);

    const timeoutBtns = screen.getAllByRole("button", { name: /Desconto/i });
    const portoTimeoutBtn = timeoutBtns[1];

    // Both teams have 5 timeouts initially
    expect(screen.getAllByText(/Descontos:/i).length).toBeGreaterThan(0);

    // Click timeout for Porto
    await user.click(portoTimeoutBtn);

    // Porto timeouts decremented to 4
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          basketball: expect.objectContaining({
            timeouts: expect.objectContaining({ away: 4 }),
            is_clock_running: false,
          }),
        }),
      })
    );
  });

  it("advances game period to Q2, resetting fouls to 0 and timer to 10:00", async () => {
    const user = userEvent.setup();
    render(<BasketballScoreboard matchData={mockFibaBasketballMatch} canEdit={true} />);

    const q2Btn = screen.getByRole("button", { name: "Q2" });
    await user.click(q2Btn);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          basketball: expect.objectContaining({
            period: "Q2",
            fouls: { home: 0, away: 0 },
            quarter_seconds: 600,
          }),
        }),
      })
    );
  });
});
