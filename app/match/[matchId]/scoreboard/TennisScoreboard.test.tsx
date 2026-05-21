import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TennisScoreboard from "./TennisScoreboard";

// Define the mock outside but without using it in vi.mock until it's ready
const insertMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: any) => insertMock(table, payload)
    })
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const mockMatchData = {
  id: "match-123",
  participants: [
    { name: "Roger Federer" },
    { name: "Rafael Nadal" }
  ],
  scores: {
    serving_index: null,
    tennis: {
      points: [0, 0],
      games: [0, 0]
    }
  },
  tournaments: { name: "Wimbledon" },
  court: "Centre Court"
};

describe("TennisScoreboard - Server Selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends both start_scoreboard and toss_coin events when a server is selected", async () => {
    const user = userEvent.setup();
    render(<TennisScoreboard matchData={mockMatchData} />);

    // Check if the toss banner is visible
    expect(screen.getByText(/Select First Server/i)).toBeInTheDocument();

    // Click on the first player to set as server
    const federerButton = screen.getByRole("button", { name: /Roger Federer/i });
    await user.click(federerButton);

    // Verify Supabase calls
    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
      
      // The component calls insert once with an array of two events
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
    render(<TennisScoreboard matchData={mockMatchData} />);

    const nadalButton = screen.getByRole("button", { name: /Rafael Nadal/i });
    await user.click(nadalButton);

    // Banner should disappear and Nadal should show as serving
    await waitFor(() => {
      expect(screen.queryByText(/Select First Server/i)).not.toBeInTheDocument();
      // Find the "Serving" indicator specifically for Nadal
      const nadalSection = screen.getByText("Rafael Nadal").closest("div");
      expect(nadalSection).toHaveTextContent(/Serving/i);
    });
  });
});
