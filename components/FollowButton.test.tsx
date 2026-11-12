import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FollowButton } from "./FollowButton";

// Mocks
const mockToggleFollow = vi.fn();
let mockIsFollowing = false;
let mockUser: any = { id: "user-1" };

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/lib/hooks/useFollow", () => ({
  useFollow: () => ({
    isFollowing: () => mockIsFollowing,
    toggleFollow: mockToggleFollow,
    updatingIds: new Set<string>(),
  }),
}));

vi.mock("@/lib/i18n/LanguageContext", () => ({
  useTranslation: () => ({
    t: (k: string) => (k === "common.following" ? "Following" : "Follow"),
  }),
}));

describe("FollowButton Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsFollowing = false;
    mockUser = { id: "user-1" };
  });

  it("renders unselected pill variant with telemetry tokens and rounded-lg shape", () => {
    render(<FollowButton entityId="match-1" entityType="match" variant="pill" />);
    const btn = screen.getByRole("button", { name: "Follow" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("w-8 h-8 rounded-lg");
    expect(btn.className).toContain("bg-surface-container-high");
    expect(btn.className).toContain("border-outline-variant");
    expect(btn.className).not.toContain("rounded-2xl");
    expect(btn.className).not.toContain("bg-amber-500");
  });

  it("renders active/following pill variant with monochrome surface and filled star", () => {
    mockIsFollowing = true;
    render(<FollowButton entityId="match-1" entityType="match" variant="pill" />);
    const btn = screen.getByRole("button", { name: "Following" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("w-8 h-8 rounded-lg");
    expect(btn.className).toContain("bg-surface-container-highest");
    expect(btn.className).toContain("text-text-primary");
    expect(btn.className).not.toContain("text-amber-400");
    expect(btn.className).not.toContain("bg-amber-500/20");

    const star = screen.getByText("star");
    expect(star).toHaveStyle({ fontVariationSettings: "'FILL' 1" });
  });

  it("renders icon variant with rounded-lg shape and toggles follow on click", async () => {
    mockToggleFollow.mockResolvedValueOnce(true);
    const onToggle = vi.fn();
    render(
      <FollowButton
        entityId="match-1"
        entityType="match"
        variant="icon"
        onFollowToggle={onToggle}
      />
    );

    const btn = screen.getByRole("button", { name: "Follow" });
    expect(btn.className).toContain("w-8 h-8 rounded-lg");

    fireEvent.click(btn);
    expect(mockToggleFollow).toHaveBeenCalledWith("match-1", "match");
  });
});
