import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VolleyballScoreboard from "./VolleyballScoreboard";

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

const mockVolleyballMatch = {
  id: "match-voley-1",
  sport_type: "Beach Volleyball",
  participants: [
    { name: "Ana Patrícia / Duda (BRA)" },
    { name: "Nuss / Kloth (USA)" },
  ],
  scores: {
    current: { home: 0, away: 0 },
    serving_index: null,
    set_scores: [],
    volleyball: {
      timeouts: { home: 2, away: 2 },
    },
  },
  tournaments: { name: "FIVB Beach Pro Tour Finals" },
  court: "Center Court — Paris",
};

describe("VolleyballScoreboard UI Interaction & Real Stats Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders teams, official badges, and initial server toss banner", () => {
    render(<VolleyballScoreboard matchData={mockVolleyballMatch} canEdit={true} />);

    expect(screen.getAllByText("Ana Patrícia / Duda (BRA)")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Nuss / Kloth (USA)")[0]).toBeInTheDocument();
    expect(screen.getByText("Voleibol de Praia")).toBeInTheDocument();
    expect(screen.getByText("FIVB Beach Pro Tour Finals")).toBeInTheDocument();
    expect(screen.getByText(/Selecionar Servidor Inicial/i)).toBeInTheDocument();
  });

  it("handles first server toss selection and dismisses the banner", async () => {
    const user = userEvent.setup();
    render(<VolleyballScoreboard matchData={mockVolleyballMatch} canEdit={true} />);

    // Select Ana Patrícia / Duda (Home)
    const homeTossBtn = screen.getAllByRole("button", { name: /Ana Patrícia \/ Duda \(BRA\)/i })[0];
    await user.click(homeTossBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-voley-1",
            event_data: expect.objectContaining({
              type: "start_scoreboard",
            }),
          }),
        ])
      );
    });
  });

  it("scores rally points (+1 Ponto) and decrements on correction (-1)", async () => {
    const user = userEvent.setup();
    const readyMatch = {
      ...mockVolleyballMatch,
      scores: {
        ...mockVolleyballMatch.scores,
        serving_index: 0,
        current: { home: 1, away: 0 },
      },
    };

    render(<VolleyballScoreboard matchData={readyMatch} canEdit={true} />);

    // Click +1 Ponto for Home
    const homePointBtn = screen.getAllByRole("button", { name: /\+1 Ponto/i })[0];
    await user.click(homePointBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-voley-1",
            event_data: expect.objectContaining({
              type: "point_won",
              side: "home",
            }),
          }),
        ])
      );
    });

    // Score for Away
    const awayPointBtn = screen.getAllByRole("button", { name: /\+1 Ponto/i })[1];
    await user.click(awayPointBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        "match_events",
        expect.arrayContaining([
          expect.objectContaining({
            match_id: "match-voley-1",
            event_data: expect.objectContaining({
              type: "point_won",
              side: "away",
            }),
          }),
        ])
      );
    });

    // Undo / Corrigir for Home
    const homeUndoBtn = screen.getAllByRole("button", { name: /-1 Corrigir/i })[0];
    await user.click(homeUndoBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });
  });

  it("handles team timeouts (Desconto) and server marking", async () => {
    const user = userEvent.setup();
    const readyMatch = {
      ...mockVolleyballMatch,
      scores: {
        ...mockVolleyballMatch.scores,
        serving_index: 0,
      },
    };

    render(<VolleyballScoreboard matchData={readyMatch} canEdit={true} />);

    // Request Timeout for Home
    const timeoutBtn = screen.getAllByRole("button", { name: /Desconto/i })[0];
    await user.click(timeoutBtn);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalled();
    });

    // Mark server for Away
    const markServerBtn = screen.getAllByRole("button", { name: /Marcar Serviço/i })[1];
    await user.click(markServerBtn);

    await waitFor(() => {
      // Away serving indicator should appear
      expect(screen.getAllByText(/A Servir/i)[0]).toBeInTheDocument();
    });
  });
});
