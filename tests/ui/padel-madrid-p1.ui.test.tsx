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
 * Ficha Oficial Premier Padel — Comunidad de Madrid Premier Padel P1 2024
 * Final Masculina: Arturo Coello / Agustín Tapia vs Alejandro Galán / Federico Chingotto
 * WiZink Center, Madrid — 8 Setembro 2024
 * Regras: FIP / Premier Padel — Ponto de Ouro (Golden Point) a 40-40, Tiebreak a 6-6
 */
const mockMadridP1Match = {
  id: "madrid-p1-final-2024",
  sport_type: "Padel",
  court: "Pista Central — WiZink Center",
  participants: [
    { name: "A. Coello / A. Tapia" },
    { name: "A. Galán / F. Chingotto" },
  ],
  scores: {
    serving_index: 0, // Coello / Tapia a servir
    tennis: {
      points: [0, 0],
      games: [0, 0],
      sets: [],
      stats: {
        aces: { home: 1, away: 0 },
        double_faults: { home: 0, away: 1 },
      },
    },
  },
  tournaments: { name: "Comunidad de Madrid Premier Padel P1" },
};

describe("Padel UI Interaction Tests — Madrid Premier Padel P1 (Coello/Tapia vs Galán/Chingotto)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Padel specific UI with 'Padel Oficial' badge and participants", () => {
    render(<TennisScoreboard matchData={mockMadridP1Match} canEdit={true} />);

    expect(screen.getByText("Padel Oficial")).toBeInTheDocument();
    expect(screen.getAllByText("A. Coello / A. Tapia")[0]).toBeInTheDocument();
    expect(screen.getAllByText("A. Galán / F. Chingotto")[0]).toBeInTheDocument();
    expect(screen.getByText("Comunidad de Madrid Premier Padel P1")).toBeInTheDocument();
  });

  it("triggers and displays 'PONTO DE OURO (SUDDEN DEATH)' at 40-40", async () => {
    const user = userEvent.setup();
    render(<TennisScoreboard matchData={mockMadridP1Match} canEdit={true} />);

    const addPointButtons = screen.getAllByRole("button", { name: /\+ Ponto/i });
    const coelloAddPoint = addPointButtons[0];
    const galanAddPoint = addPointButtons[1];

    // Rally 1: 15 - 0
    await user.click(coelloAddPoint);
    // Rally 2: 15 - 15
    await user.click(galanAddPoint);
    // Rally 3: 30 - 15
    await user.click(coelloAddPoint);
    // Rally 4: 30 - 30
    await user.click(galanAddPoint);
    // Rally 5: 40 - 30
    await user.click(coelloAddPoint);
    // Rally 6: 40 - 40 -> Golden Point!
    await user.click(galanAddPoint);

    // Verify Ponto de Ouro alert banner in Padel
    expect(screen.getByText(/PONTO DE OURO \(SUDDEN DEATH\)/i)).toBeInTheDocument();

    // Verify both have 40 on digital scores
    const digitalScores = screen.getAllByText("40");
    expect(digitalScores.length).toBeGreaterThanOrEqual(2);

    // Verify Golden Point winning click (Coello smashes winner)
    await user.click(coelloAddPoint);
    expect(insertMock).toHaveBeenLastCalledWith(
      "match_events",
      expect.arrayContaining([
        expect.objectContaining({
          event_data: { type: "point_won", side: "home" },
        }),
      ])
    );
  });

  it("allows undoing a point (-1 Corrigir) when referee changes a challenge decision", async () => {
    const user = userEvent.setup();
    const matchWithPoints = {
      ...mockMadridP1Match,
      scores: {
        serving_index: 0,
        tennis: {
          points: [2, 1], // 30 - 15
          games: [4, 3],
          stats: { aces: { home: 0, away: 0 }, double_faults: { home: 0, away: 0 } },
        },
      },
    };

    render(<TennisScoreboard matchData={matchWithPoints} canEdit={true} />);

    const undoButtons = screen.getAllByTitle("Corrigir / Subtrair Ponto");
    const undoHomeBtn = undoButtons[0];

    // Click undo for Coello/Tapia (30 -> 15)
    await user.click(undoHomeBtn);

    // Check that update call was sent with decremented points
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scores: expect.objectContaining({
          tennis: expect.objectContaining({
            points: [1, 1],
          }),
        }),
      })
    );
  });

  it("terminates match when clicking Terminar Jogo button with confirmation", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<TennisScoreboard matchData={mockMadridP1Match} canEdit={true} />);

    const finalizeBtn = screen.getByRole("button", { name: /Terminar Jogo/i });
    await user.click(finalizeBtn);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("Tens a certeza que queres terminar este jogo de Padel?")
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
      })
    );
  });
});
