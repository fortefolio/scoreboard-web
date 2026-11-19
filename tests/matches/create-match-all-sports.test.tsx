import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyMatchesPage from "@/app/my-matches/page";
import { SUPPORTED_SPORT_VALUES } from "@/lib/sports";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

const mockUser = {
  id: "user-match-creator-1",
  email: "creator@scoreboard.app",
};

const insertMock = vi.fn().mockReturnValue({
  select: vi.fn().mockResolvedValue({ data: [{ id: "new-match-1" }], error: null }),
});

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === "matches") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        insert: insertMock,
      };
    }
    if (table === "tournaments") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }
    return { select: vi.fn() };
  }),
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockUser,
    supabase: mockSupabase,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Create Match — All Supported Sports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(SUPPORTED_SPORT_VALUES)("creates a match for %s", async (sport) => {
    render(<MyMatchesPage />);

    const newMatchBtn = await screen.findByRole("button", { name: /New Match/i });
    fireEvent.click(newMatchBtn);

    fireEvent.change(screen.getByPlaceholderText("Team Alpha"), { target: { value: "Alpha" } });
    fireEvent.change(screen.getByPlaceholderText("Team Beta"), { target: { value: "Beta" } });

    // Open Sport Type SelectField in the modal (last Tennis button, after SportFilterBar)
    const sportButton = screen.getAllByRole("button", { name: /Tennis/i }).at(-1)!;
    fireEvent.click(sportButton);
    const optionButton = screen.getByRole("option", {
      name: new RegExp(`^${sport}`, "i"),
    });
    fireEvent.click(optionButton);

    fireEvent.click(screen.getAllByRole("button", { name: /^Create Match$/i }).at(-1)!);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sport_type: sport,
          organizer_id: mockUser.id,
          status: "scheduled",
          participants: [{ name: "Alpha" }, { name: "Beta" }],
        })
      );
    });
  });
});
