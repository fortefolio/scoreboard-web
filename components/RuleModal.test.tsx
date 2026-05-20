import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RuleModal from "./RuleModal";

const baseProps = {
  roundNum: 1,
  initialRules: { max_sets: 3, points_per_set: 21, point_cap: null as number | null },
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

describe("RuleModal", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<RuleModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("hides points-per-set and cap fields for Tennis", () => {
    render(<RuleModal {...baseProps} sportType="Tennis" />);
    expect(screen.queryByText(/points per set/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/point cap/i)).not.toBeInTheDocument();
    expect(screen.getByText(/maximum sets/i)).toBeInTheDocument();
  });

  it("shows points-per-set and cap fields for non-Tennis sports", () => {
    render(<RuleModal {...baseProps} sportType="Volleyball" />);
    expect(screen.getByText(/points per set/i)).toBeInTheDocument();
    expect(screen.getByText(/point cap/i)).toBeInTheDocument();
  });

  it("saves the initial rules unchanged when Save is clicked without edits", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<RuleModal {...baseProps} onSave={onSave} onClose={onClose} sportType="Volleyball" />);

    await user.click(screen.getByRole("button", { name: /save rules/i }));

    // (sets, points, cap, court) — cap=null (no input), court=null (empty trimmed)
    expect(onSave).toHaveBeenCalledWith(3, 21, null, null);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("passes edited sets/points/cap/court into onSave", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <RuleModal
        {...baseProps}
        sportType="Volleyball"
        initialRules={{ max_sets: 3, points_per_set: 25, point_cap: null }}
        onSave={onSave}
      />
    );

    const inputs = screen.getAllByRole("spinbutton") as HTMLInputElement[];
    // Order in the DOM: max_sets, points_per_set, point_cap.
    // Use fireEvent.change for number inputs because the component's
    // parseInt(value) || 1 fallback turns clear()'d inputs into "1", which
    // breaks the clear-then-type pattern.
    fireEvent.change(inputs[0], { target: { value: "5" } });
    fireEvent.change(inputs[1], { target: { value: "21" } });
    fireEvent.change(inputs[2], { target: { value: "27" } });

    // Court is the only text input
    const court = screen.getByPlaceholderText(/center court/i) as HTMLInputElement;
    await user.type(court, "Arena 1");

    await user.click(screen.getByRole("button", { name: /save rules/i }));

    expect(onSave).toHaveBeenCalledWith(5, 21, 27, "Arena 1");
  });

  it("trims whitespace-only court to null", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<RuleModal {...baseProps} sportType="Tennis" onSave={onSave} initialCourt="   " />);

    await user.click(screen.getByRole("button", { name: /save rules/i }));
    // The court starts with "   " (whitespace-only) → trim → null
    expect(onSave).toHaveBeenCalledWith(3, 21, null, null);
  });

  it("calls only onClose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(<RuleModal {...baseProps} onSave={onSave} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
