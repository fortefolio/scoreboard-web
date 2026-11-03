import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MyTournamentsPage from "./page";

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
