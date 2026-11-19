import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TournamentPage from "@/app/tournament/[id]/page";

let mockSearchParams = new URLSearchParams();
let mockCurrentUser: { id: string; email: string } | null = {
  id: "owner-123",
  email: "owner@scoreboard.app",
};

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "tour-1" }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockCurrentUser,
    supabase: mockSupabase,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function setupTournamentMocks(participants: any[] = []) {
  const tournamentRecord = {
    id: "tour-1",
    name: "Open Championship",
    sport_type: "Tennis",
    status: "pending",
    visibility: "public",
    organizer_id: "owner-123",
    organizer: { username: "owneruser" },
    settings: { max_teams: 8, stage_1: { type: "bracket" } },
    signup_schema: [],
  };

  mockSupabase.rpc.mockResolvedValue({ data: participants, error: null });
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "tournaments") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: tournamentRecord, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "tournament_participants") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: participants, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "part-new", name: "Team 1", tournament_id: "tour-1" },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "follows") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    }
    return { select: vi.fn() };
  });
}

describe("Tournament Management & Owner Permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("hides Settings tab and owner-only roster controls for non-owners even with ?tab=settings", async () => {
    mockCurrentUser = { id: "viewer-999", email: "viewer@scoreboard.app" };
    mockSearchParams = new URLSearchParams("tab=settings");
    setupTournamentMocks([{ id: "p1", name: "Alpha", contact_email: null }]);

    render(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByText("Open Championship")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Settings/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Tournament Settings")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Roster Actions/i })).not.toBeInTheDocument();
    expect(screen.getByText("@owneruser")).toBeInTheDocument();
  });

  it("shows Settings tab and owner roster controls for the tournament organizer", async () => {
    mockCurrentUser = { id: "owner-123", email: "owner@scoreboard.app" };
    setupTournamentMocks([{ id: "p1", name: "Alpha", contact_email: "a@b.com" }]);

    render(<TournamentPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Settings/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /Add Team/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Roster Actions/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Settings/i }));
    await waitFor(() => {
      expect(screen.getByText("Tournament Settings")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Generate Tournament Bracket/i })).toBeInTheDocument();
    });
  });
});
