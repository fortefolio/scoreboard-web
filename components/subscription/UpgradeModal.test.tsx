import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UpgradeModal from "./UpgradeModal";

const mockRpc = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({
    rpc: mockRpc,
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("UpgradeModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: "mock-token" } },
    });
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(<UpgradeModal isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with monthly and annual plan pricing when open", () => {
    render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText(/Host & Manage Your Tournaments/i)).toBeInTheDocument();
    // Default is annual (€34.99)
    expect(screen.getByText("€34.99")).toBeInTheDocument();
    expect(screen.getByText(/-27%/i)).toBeInTheDocument();
  });

  it("toggles between monthly and annual billing cycles", () => {
    render(<UpgradeModal isOpen={true} onClose={vi.fn()} />);

    const monthlyButton = screen.getByRole("button", { name: /^Monthly$/i });
    fireEvent.click(monthlyButton);

    expect(screen.getByText("€3.99")).toBeInTheDocument();
    expect(screen.getByText(/\/ month/i)).toBeInTheDocument();

    const annualButton = screen.getByRole("button", { name: /Annual/i });
    fireEvent.click(annualButton);

    expect(screen.getByText("€34.99")).toBeInTheDocument();
  });

  it("allows redeeming a club beta voucher code", async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        message: "Voucher redeemed successfully! Welcome to Pro Organizer.",
      },
      error: null,
    });

    const mockOnSuccess = vi.fn();
    const mockOnClose = vi.fn();

    // Mock window.location.reload
    const originalReload = window.location.reload;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, reload: vi.fn() },
    });

    render(<UpgradeModal isOpen={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />);

    // Click "Have a club voucher or beta code? Redeem here"
    const showVoucherBtn = screen.getByText(/Have a club voucher or beta code/i);
    fireEvent.click(showVoucherBtn);

    const input = screen.getByPlaceholderText(/e\.g\. BETA-CLUB-60D/i);
    fireEvent.change(input, { target: { value: "BETA-CLUB-60D" } });

    const redeemBtn = screen.getByRole("button", { name: /Redeem/i });
    fireEvent.click(redeemBtn);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("redeem_voucher", {
        code_input: "BETA-CLUB-60D",
      });
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });

    window.location.reload = originalReload;
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(<UpgradeModal isOpen={true} onClose={handleClose} />);

    const closeBtn = screen.getByRole("button", { name: /Close modal/i });
    fireEvent.click(closeBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
