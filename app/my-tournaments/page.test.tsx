import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyTournamentsPage from "./page";

const routerPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const mockUser = {
  id: "user-free-123",
  email: "freeuser@scoreboard.app",
};

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
  },
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

describe("MyTournamentsPage - Pro Paywall Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("intercepts New Tournament click for Free users and opens UpgradeModal", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tournaments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { subscription_tier: "free" },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<MyTournamentsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /New Tournament/i })).toBeInTheDocument();
    });

    // Click "New Tournament" as free user
    fireEvent.click(screen.getByRole("button", { name: /New Tournament/i }));

    // Expect UpgradeModal paywall to be shown
    await waitFor(() => {
      expect(screen.getByText(/Host & Manage Your Tournaments/i)).toBeInTheDocument();
      expect(screen.getByText("€34.99")).toBeInTheDocument();
    });
  });

  it("opens tournament creation modal directly for Pro users", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tournaments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { subscription_tier: "pro" },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<MyTournamentsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /New Tournament/i })).toBeInTheDocument();
    });

    // Click "New Tournament" as pro user
    fireEvent.click(screen.getByRole("button", { name: /New Tournament/i }));

    // Expect Create Event modal to be shown
    await waitFor(() => {
      expect(screen.getByText("NEW TOURNAMENT")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g. Summer Open 2026")).toBeInTheDocument();
    });
  });
});

describe("MyTournamentsPage - Tournament Creation & Reset (Issue #14)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a tournament, resets the form, closes modal, and redirects to the new tournament page", async () => {
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: "new-tournament-123" },
          error: null,
        }),
      }),
    });

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tournaments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
          insert: insertMock,
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { subscription_tier: "pro" },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<MyTournamentsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /New Tournament/i })).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /New Tournament/i }));

    const nameInput = await screen.findByPlaceholderText("e.g. Summer Open 2026");
    fireEvent.change(nameInput, { target: { value: "Summer Championship" } });

    // Click "Create Event"
    const createBtn = screen.getByRole("button", { name: /Create Event/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalled();
      expect(routerPush).toHaveBeenCalledWith("/tournament/new-tournament-123");
    });

    // Modal should be closed
    expect(screen.queryByText("NEW TOURNAMENT")).not.toBeInTheDocument();
  });

  it("resets form inputs when user cancels the creation modal", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "tournaments") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { subscription_tier: "pro" },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    render(<MyTournamentsPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /New Tournament/i })).toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /New Tournament/i }));

    const nameInput = await screen.findByPlaceholderText("e.g. Summer Open 2026");
    fireEvent.change(nameInput, { target: { value: "Draft Tournament" } });
    expect(nameInput).toHaveValue("Draft Tournament");

    // Click Cancel
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    // Reopen modal: input should be empty
    fireEvent.click(screen.getByRole("button", { name: /New Tournament/i }));
    const reopenedInput = await screen.findByPlaceholderText("e.g. Summer Open 2026");
    expect(reopenedInput).toHaveValue("");
  });
});
