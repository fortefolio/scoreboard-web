import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@supabase/supabase-js";
import { createSupabaseMock } from "@/tests/helpers/supabase-mock";

const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn(),
    refresh: routerRefresh,
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

const supabaseMock = createSupabaseMock();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => supabaseMock,
}));

vi.mock("./NotificationBell", () => ({
  default: () => <div data-testid="notification-bell" />,
}));

// Imports must come after the vi.mock calls.
import { AuthProvider } from "./AuthProvider";
import TopNavBar from "./TopNavBar";

const renderNav = (user: User | null) =>
  render(
    <AuthProvider initialUser={user}>
      <TopNavBar />
    </AuthProvider>
  );

const userWithEmail = { id: "u1", email: "alice@example.com", user_metadata: {} } as unknown as User;

const userWithAvatar = {
  id: "u2",
  email: "bob@example.com",
  user_metadata: { avatar_url: "https://example.com/avatar.png" },
} as unknown as User;

describe("TopNavBar — guest", () => {
  beforeEach(() => {
    routerPush.mockClear();
    routerRefresh.mockClear();
  });

  it('shows the "Get Started" link', () => {
    renderNav(null);
    expect(screen.getByRole("link", { name: /get started/i })).toHaveAttribute("href", "/?auth=signup");
  });

  it("does not render the avatar menu trigger", () => {
    renderNav(null);
    expect(screen.queryByRole("button", { name: /signed in as/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument();
  });

  it("does not render NotificationBell", () => {
    renderNav(null);
    expect(screen.queryByTestId("notification-bell")).not.toBeInTheDocument();
  });

  it("does not render the authed nav links", () => {
    renderNav(null);
    expect(screen.queryByRole("link", { name: /matches/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /tournaments/i })).not.toBeInTheDocument();
  });
});

describe("TopNavBar — authenticated", () => {
  beforeEach(() => {
    routerPush.mockClear();
    routerRefresh.mockClear();
    supabaseMock.auth.signOut.mockClear();
  });

  it("renders the avatar initial when no avatar_url is set", () => {
    renderNav(userWithEmail);
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /avatar/i })).not.toBeInTheDocument();
  });

  it("renders an <img> when user_metadata.avatar_url is set", () => {
    renderNav(userWithAvatar);
    const img = screen.getByRole("img", { name: /avatar/i });
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
  });

  it("renders NotificationBell and the authed nav links", () => {
    renderNav(userWithEmail);
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /matches/i })).toHaveAttribute("href", "/#matches");
    expect(screen.getByRole("link", { name: /tournaments/i })).toHaveAttribute("href", "/#tournaments");
  });

  it('does not show the "Get Started" link', () => {
    renderNav(userWithEmail);
    expect(screen.queryByRole("link", { name: /get started/i })).not.toBeInTheDocument();
  });

  it("opens the dropdown on avatar click and shows the user email", async () => {
    const user = userEvent.setup();
    renderNav(userWithEmail);
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();

    // The avatar button is the first <button> inside the nav.
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);

    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("navigates and closes the menu when clicking Settings / My Matches / My Tournaments", async () => {
    const user = userEvent.setup();
    renderNav(userWithEmail);
    const trigger = screen.getAllByRole("button")[0];
    await user.click(trigger);

    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(routerPush).toHaveBeenCalledWith("/settings");
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /my matches/i }));
    expect(routerPush).toHaveBeenCalledWith("/my-matches");

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /my tournaments/i }));
    expect(routerPush).toHaveBeenCalledWith("/my-tournaments");
  });

  it("Sign Out delegates to supabase.auth.signOut and closes the menu", async () => {
    const user = userEvent.setup();
    renderNav(userWithEmail);
    await user.click(screen.getAllByRole("button")[0]);

    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });

  it("closes the menu when clicking outside the nav", async () => {
    const user = userEvent.setup();
    renderNav(userWithEmail);
    await user.click(screen.getAllByRole("button")[0]);
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();

    // Click on the document body, outside the menu ref.
    await user.click(document.body);

    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument();
  });
});
