import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmationModal from "./ConfirmationModal";

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
  title: "Delete Tournament",
  message: "This cannot be undone.",
};

describe("ConfirmationModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<ConfirmationModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders title and message when isOpen is true", () => {
    render(<ConfirmationModal {...baseProps} />);
    expect(screen.getByRole("heading", { name: /delete tournament/i })).toBeInTheDocument();
    expect(screen.getByText(/this cannot be undone/i)).toBeInTheDocument();
  });

  it("renders default Confirm / Cancel button labels", () => {
    render(<ConfirmationModal {...baseProps} />);
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("honors custom confirmText / cancelText", () => {
    render(<ConfirmationModal {...baseProps} confirmText="Delete" cancelText="Keep" />);
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep/i })).toBeInTheDocument();
  });

  it("calls only onClose when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmationModal {...baseProps} onClose={onClose} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("calls onConfirm AND onClose when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmationModal {...baseProps} onClose={onClose} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
