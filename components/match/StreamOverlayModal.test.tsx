import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StreamOverlayModal from "./StreamOverlayModal";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("StreamOverlayModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
      writable: true,
      configurable: true,
    });
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <StreamOverlayModal isOpen={false} onClose={vi.fn()} matchId="test-match-123" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders overlay modal with title and browser source URL when open", () => {
    render(
      <StreamOverlayModal isOpen={true} onClose={vi.fn()} matchId="test-match-123" />
    );

    expect(screen.getByText(/OBS & vMix Broadcast Scoreboard/i)).toBeInTheDocument();
    const input = screen.getByDisplayValue(/test-match-123\/overlay\?pos=top&scale=md/i);
    expect(input).toBeInTheDocument();
  });

  it("updates overlay URL when position or scale are toggled", () => {
    render(
      <StreamOverlayModal isOpen={true} onClose={vi.fn()} matchId="test-match-123" />
    );

    // Toggle bottom position
    const bottomBtn = screen.getByRole("button", { name: /^Bottom$/i });
    fireEvent.click(bottomBtn);
    expect(screen.getByDisplayValue(/pos=bottom&scale=md/i)).toBeInTheDocument();

    // Toggle lg scale
    const lgBtn = screen.getByRole("button", { name: /^LG$/i });
    fireEvent.click(lgBtn);
    expect(screen.getByDisplayValue(/pos=bottom&scale=lg/i)).toBeInTheDocument();
  });

  it("copies overlay URL to clipboard on copy button click", async () => {
    render(
      <StreamOverlayModal isOpen={true} onClose={vi.fn()} matchId="test-match-123" />
    );

    const copyBtn = screen.getByRole("button", { name: /Copy/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/match/test-match-123/overlay?pos=top&scale=md")
      );
    });
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <StreamOverlayModal isOpen={true} onClose={handleClose} matchId="test-match-123" />
    );

    const closeBtn = screen.getByRole("button", { name: /Close modal/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
