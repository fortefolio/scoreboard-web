import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VolleyballScoreboard from "@/app/match/[matchId]/scoreboard/VolleyballScoreboard";

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
 * Ficha Oficial FPV — Liga UNA Seguros Jogo nº 136
 * Clube Kairós vs VC Viana (3-2: 19-25, 25-22, 25-20, 18-25, 15-10)
 * Pavilhão CD Laranjeiras, Ponta Delgada
 */
const mockVolleyball136Match = {
  id: "fpv-una-match-136",
  sport_type: "Volleyball",
  court: "Pavilhão CD Laranjeiras — Ponta Delgada",
  participants: [
    { name: "Clube Kairós" },
    { name: "VC Viana" },
  ],
  scores: {
    serving_index: null,
    current: { home: 0, away: 0 },
    volleyball: {
      sets: [],
      current_set: 1,
      timeouts: { home: 2, away: 2 },
    },
  },
  tournaments: { name: "Liga UNA Seguros 2026/27" },
};

describe("Volleyball UI Interaction Tests — FPV Liga UNA Seguros (Clube Kairós vs VC Viana)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles toss coin selection to set Clube Kairós as first server", async () => {
    const user = userEvent.setup();
    render(<VolleyballScoreboard matchData={mockVolleyball136Match} canEdit={true} />);

    expect(screen.getByText("Selecionar Servidor Inicial")).toBeInTheDocument();

    const kairosTossBtn = screen.getByRole("button", { name: "Clube Kairós" });
    await user.click(kairosTossBtn);

    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          match_id: "fpv-una-match-136",
          event_data: { type: "start_scoreboard", initial_server_index: 0 },
        }),
      ])
    );
  });

  it("simulates rally scoring (+1 Ponto), side-out service rotation, and -1 correction", async () => {
    const user = userEvent.setup();
    const matchWithServer = {
      ...mockVolleyball136Match,
      scores: {
        ...mockVolleyball136Match.scores,
        serving_index: 0, // Clube Kairós serving
      },
    };

    render(<VolleyballScoreboard matchData={matchWithServer} canEdit={true} />);

    const pointButtons = screen.getAllByRole("button", { name: /\+1 Ponto/i });
    const kairosAddPoint = pointButtons[0];
    const vianaAddPoint = pointButtons[1];

    // Rally 1: Kairós scores (+1 Ponto) -> 1 - 0
    await user.click(kairosAddPoint);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_won", side: "home" },
        }),
      ])
    );

    // Rally 2: VC Viana scores sideout (+1 Ponto) -> 1 - 1
    await user.click(vianaAddPoint);
    expect(insertMock).toHaveBeenCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_won", side: "away" },
        }),
      ])
    );

    // Rotate server to VC Viana (side-out)
    const rotateBtns = screen.getAllByRole("button", { name: /Marcar Serviço/i });
    await user.click(rotateBtns[1]);
    expect(screen.getByText("A Servir")).toBeInTheDocument();

    // Correction: referee corrects call with -1 Corrigir
    const undoButtons = screen.getAllByRole("button", { name: /-1 Corrigir/i });
    await user.click(undoButtons[1]);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          current: expect.objectContaining({ away: 0 }),
        }),
      })
    );
  });

  it("decrements team timeouts when Desconto button is clicked", async () => {
    const user = userEvent.setup();
    const matchWithServer = {
      ...mockVolleyball136Match,
      scores: {
        ...mockVolleyball136Match.scores,
        serving_index: 0,
      },
    };

    render(<VolleyballScoreboard matchData={matchWithServer} canEdit={true} />);

    // Timeouts: 2/2 initially
    expect(screen.getAllByText("Descontos:").length).toBeGreaterThan(0);

    const timeoutBtns = screen.getAllByRole("button", { name: /Desconto/i });
    const kairosTimeout = timeoutBtns[0];

    // Click Desconto for Kairós
    await user.click(kairosTimeout);

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          volleyball: expect.objectContaining({
            timeouts: expect.objectContaining({ home: 1 }),
          }),
        }),
      })
    );
  });

  it("handles deciding 5th set target points of 15 and displays 'Set Decisivo (Negra)'", () => {
    const matchIn5thSet = {
      ...mockVolleyball136Match,
      scores: {
        serving_index: 0,
        current: { home: 8, away: 7 },
        sets: [
          { home: 19, away: 25 },
          { home: 25, away: 22 },
          { home: 25, away: 20 },
          { home: 18, away: 25 },
        ],
        volleyball: {
          current_set: 5,
          timeouts: { home: 2, away: 2 },
        },
      },
    };

    render(<VolleyballScoreboard matchData={matchIn5thSet} canEdit={true} />);

    // In 5th set, target is 15 points
    expect(screen.getByText("Set Decisivo (Negra)")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });
});
