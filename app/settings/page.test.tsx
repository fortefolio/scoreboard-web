import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "./page";

// Mock router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock Supabase & Auth
const mockUser = {
  id: "user-123-uuid",
  email: "testuser@scoreboard.app",
};

const mockSignOut = vi.fn();
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    updateUser: vi.fn(),
  },
};

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({
    user: mockUser,
    supabase: mockSupabase,
    signOut: mockSignOut,
  }),
}));

describe("SettingsPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "users") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  username: "johndoe",
                  display_name: "John Doe",
                  subscription_tier: "free",
                  preferences: {
                    language: "en",
                    default_sport: "tennis",
                    sound_enabled: true,
                  },
                },
                error: null,
              }),
            }),
            ilike: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null, // No conflicting username
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {
        select: vi.fn(),
        update: vi.fn(),
      };
    });

    mockSupabase.rpc.mockImplementation((fn: string) => {
      if (fn === "export_user_data") {
        return Promise.resolve({
          data: {
            profile: { id: "user-123-uuid", username: "johndoe" },
            tournaments: [],
            matches: [],
          },
          error: null,
        });
      }
      if (fn === "delete_user_account") {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("renders profile settings by default with loaded user information", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("testuser@scoreboard.app")).toBeInTheDocument();
      expect(screen.getByDisplayValue("johndoe")).toBeInTheDocument();
      expect(screen.getByDisplayValue("John Doe")).toBeInTheDocument();
      expect(screen.getByText(/FREE PLAN/i)).toBeInTheDocument();
    });
  });

  it("switches to Preferences tab and allows updating options", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Preferences")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Preferences"));

    await waitFor(() => {
      expect(screen.getByText("Display Language")).toBeInTheDocument();
      expect(screen.getByText("Default Sport Filter")).toBeInTheDocument();
      expect(screen.getByText("Save Preferences")).toBeInTheDocument();
    });
  });

  it("switches to Notifications tab and renders toggle switches for global and sport-specific alerts", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("settings-tab-notifications")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("settings-tab-notifications"));

    await waitFor(() => {
      expect(screen.getByTestId("web-notification-settings")).toBeInTheDocument();
    });

    const allNotifSwitch = screen.getByTestId("web-notif-switch-all");
    const umpireSwitch = screen.getByTestId("web-notif-switch-umpire");
    const tennisAllSwitch = screen.getByTestId("web-notif-switch-tennis-all");
    const tennisSetsSwitch = screen.getByTestId("web-notif-switch-tennis-sets");
    const tennisGamesSwitch = screen.getByTestId("web-notif-switch-tennis-games");
    const volleyAllSwitch = screen.getByTestId("web-notif-switch-volley-all");
    const footballAllSwitch = screen.getByTestId("web-notif-switch-football-all");
    const footballGoalsSwitch = screen.getByTestId("web-notif-switch-football-goals");
    const footballCardsSwitch = screen.getByTestId("web-notif-switch-football-cards");
    const basketballAllSwitch = screen.getByTestId("web-notif-switch-basketball-all");
    const basketballPointsSwitch = screen.getByTestId("web-notif-switch-basketball-points");
    const basketballQuartersSwitch = screen.getByTestId("web-notif-switch-basketball-quarters");

    expect(allNotifSwitch).toHaveAttribute("aria-checked", "true");
    expect(umpireSwitch).toHaveAttribute("role", "switch");
    expect(umpireSwitch).toHaveAttribute("aria-checked", "true");
    expect(tennisAllSwitch).toHaveAttribute("aria-checked", "true");
    expect(tennisSetsSwitch).toHaveAttribute("aria-checked", "true");
    expect(tennisGamesSwitch).toHaveAttribute("aria-checked", "false");
    expect(volleyAllSwitch).toHaveAttribute("aria-checked", "true");
    expect(footballAllSwitch).toHaveAttribute("aria-checked", "true");
    expect(footballGoalsSwitch).toHaveAttribute("aria-checked", "true");
    expect(footballCardsSwitch).toHaveAttribute("aria-checked", "true");
    expect(basketballAllSwitch).toHaveAttribute("aria-checked", "true");
    expect(basketballPointsSwitch).toHaveAttribute("aria-checked", "true");
    expect(basketballQuartersSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(umpireSwitch);
    expect(umpireSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(footballCardsSwitch);
    expect(footballCardsSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(basketballQuartersSwitch);
    expect(basketballQuartersSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(tennisAllSwitch);
    expect(tennisAllSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(basketballAllSwitch);
    expect(basketballAllSwitch).toHaveAttribute("aria-checked", "false");
    fireEvent.click(allNotifSwitch);
    expect(allNotifSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("switches to Security tab and allows GDPR data export trigger", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Security & Credentials")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Security & Credentials"));

    await waitFor(() => {
      expect(screen.getByText(/GDPR Data Portability/i)).toBeInTheDocument();
      expect(screen.getByText("Download My Data (JSON)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Download My Data (JSON)"));

    await waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith("export_user_data");
    });
  });

  it("switches to Danger Zone and protects account deletion behind DELETE confirmation", async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText("Danger Zone")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Danger Zone"));

    await waitFor(() => {
      expect(screen.getByText(/Delete Account \(GDPR Article 17\)/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /Permanently Delete Account/i });
    expect(deleteButton).toBeDisabled();

    const confirmInput = screen.getByPlaceholderText("DELETE");
    fireEvent.change(confirmInput, { target: { value: "DELETE" } });

    expect(deleteButton).not.toBeDisabled();

    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(mockSupabase.rpc).toHaveBeenCalledWith("delete_user_account");
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });
});
