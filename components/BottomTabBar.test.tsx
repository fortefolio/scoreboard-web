import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import BottomTabBar from "./BottomTabBar";

let mockPathname = "/";
let mockSearchParams = new URLSearchParams();
let mockUser: { id: string } | null = { id: "user-1" };
let mockUnreadCount = 0;

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock("@/lib/hooks/useNotifications", () => ({
  useNotifications: () => ({ unreadCount: mockUnreadCount }),
}));

const renderTabBar = () =>
  render(
    <LanguageProvider>
      <BottomTabBar />
    </LanguageProvider>
  );

describe("BottomTabBar", () => {
  beforeEach(() => {
    mockPathname = "/";
    mockSearchParams = new URLSearchParams();
    mockUser = { id: "user-1" };
    mockUnreadCount = 0;
  });

  it("hides on /overlay routes", () => {
    mockPathname = "/match/123/overlay";
    const { container } = renderTabBar();
    expect(container.firstChild).toBeNull();
  });

  it("hides on /scoreboard routes", () => {
    mockPathname = "/match/123/scoreboard";
    const { container } = renderTabBar();
    expect(container.firstChild).toBeNull();
  });

  it("hides on the guest landing page (/ when not logged in)", () => {
    mockPathname = "/";
    mockUser = null;
    const { container } = renderTabBar();
    expect(container.firstChild).toBeNull();
  });

  it("renders all 4 navigation tabs when authenticated", () => {
    mockPathname = "/";
    mockUser = { id: "user-1" };
    renderTabBar();

    expect(screen.getByRole("link", { name: /matches/i })).toHaveAttribute("href", "/?tab=matches");
    expect(screen.getByRole("link", { name: /tournaments/i })).toHaveAttribute("href", "/?tab=tournaments");
    expect(screen.getByRole("link", { name: /favorites|following/i })).toHaveAttribute("href", "/?tab=following");
    expect(screen.getByRole("link", { name: /notifications/i })).toHaveAttribute("href", "/notifications");
  });

  it("shows unread notification badge when unreadCount > 0", () => {
    mockUnreadCount = 3;
    renderTabBar();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
