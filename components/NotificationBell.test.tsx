import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { User } from "@supabase/supabase-js";
import { createSupabaseMock } from "@/tests/helpers/supabase-mock";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
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

// Mock the barrel too because useAuth uses it
vi.mock("@/lib/supabase", () => ({
  supabase: supabaseMock,
}));

const toastInfo = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { info: (...args: unknown[]) => toastInfo(...args), error: (...args: unknown[]) => toastError(...args) },
}));

import { AuthProvider } from "./AuthProvider";
import NotificationBell from "./NotificationBell";

const testUser = { id: "user-1", email: "alice@example.com" } as unknown as User;

const renderBell = (user: User | null) =>
  render(
    <AuthProvider initialUser={user}>
      <NotificationBell />
    </AuthProvider>
  );

const note = (overrides: Partial<{ id: string; title: string; body: string; read_at: string | null; created_at: string; data: any }> = {}) => ({
  id: "n1",
  title: "Hello",
  body: "World",
  read_at: null,
  created_at: "2026-01-01T00:00:00Z",
  data: null,
  ...overrides,
});

describe("NotificationBell — guest", () => {
  beforeEach(() => {
    supabaseMock.__resetResponses();
    toastInfo.mockClear();
    toastError.mockClear();
  });

  it("renders nothing when no user is signed in", () => {
    const { container } = renderBell(null);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("NotificationBell — authenticated", () => {
  beforeEach(() => {
    supabaseMock.__resetResponses();
    supabaseMock.channel.mockClear();
    // Channel mock is a singleton; clear its inner mocks too.
    const ch = supabaseMock.channel.getMockImplementation()?.("anything");
    ch?.on?.mockClear?.();
    ch?.subscribe?.mockClear?.();
    toastInfo.mockClear();
    toastError.mockClear();
  });

  it("shows the bell with no badge when there are no notifications", async () => {
    supabaseMock.__queueResponse("notifications", { data: [], error: null });
    renderBell(testUser);

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
    // No numeric badge
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows an unread badge equal to the number of unread notifications", async () => {
    supabaseMock.__queueResponse("notifications", {
      data: [
        note({ id: "a", read_at: null }),
        note({ id: "b", read_at: null }),
        note({ id: "c", read_at: "2026-01-02T00:00:00Z" }),
      ],
      error: null,
    });
    renderBell(testUser);

    expect(await screen.findByText("2")).toBeInTheDocument();
  });

  it("opens the dropdown when the bell is clicked and lists the notifications", async () => {
    const user = userEvent.setup();
    supabaseMock.__queueResponse("notifications", {
      data: [note({ id: "a", title: "First", body: "Match starting" })],
      error: null,
    });
    renderBell(testUser);

    // Wait for fetch to populate
    await screen.findByText("1");

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("First")).toBeInTheDocument();
    // Body is no longer rendered in the notification bell drawer redesign
    expect(screen.queryByText("Match starting")).not.toBeInTheDocument();
  });

  it('shows "No activity detected" empty state when the list is empty', async () => {
    const user = userEvent.setup();
    supabaseMock.__queueResponse("notifications", { data: [], error: null });
    renderBell(testUser);

    await waitFor(() => expect(screen.getByRole("button")).toBeInTheDocument());
    await user.click(screen.getByRole("button"));

    expect(screen.getByText(/no activity detected/i)).toBeInTheDocument();
  });

  it('"Mark all as read" only appears when there are unread, and zeroes the badge on click', async () => {
    const user = userEvent.setup();
    supabaseMock.__queueResponse("notifications", {
      data: [note({ id: "a", read_at: null }), note({ id: "b", read_at: null })],
      error: null,
    });
    // The markAllAsRead update call resolves with { error: null }
    // We queue a fallback response just in case
    supabaseMock.__queueResponse("notifications", { data: null, error: null });

    renderBell(testUser);
    expect(await screen.findByText("2")).toBeInTheDocument();

    await user.click(screen.getByRole("button"));
    const markAllBtn = await screen.findByRole("button", { name: /mark all as read/i });
    
    // Wrap in act to ensure all async state changes are processed
    await act(async () => {
      await user.click(markAllBtn);
    });

    await waitFor(() => {
      // Numerical badge should be gone
      expect(screen.queryByText("2")).not.toBeInTheDocument();
      // Button itself should be gone since there are no more unread
      expect(screen.queryByRole("button", { name: /mark all as read/i })).not.toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it("real-time INSERT prepends the notification, bumps the badge, and toasts", async () => {
    supabaseMock.__queueResponse("notifications", { data: [], error: null });
    renderBell(testUser);

    // Wait until the hook has subscribed via the channel
    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalled());

    // Find the most-recently-registered '*' handler. 
    const channelInstance = supabaseMock.channel.mock.results.at(-1)!.value;
    const starCalls = channelInstance.on.mock.calls.filter(
      (c: any[]) => c[1]?.event === "*"
    );
    expect(starCalls.length).toBeGreaterThan(0);
    const handler = starCalls.at(-1)![2];

    await act(async () => {
      handler({ 
        eventType: 'INSERT',
        new: { id: "live-1", title: "Live!", body: "Score update", read_at: null, created_at: "2026-01-03T00:00:00Z" } 
      });
    });

    expect(await screen.findByText("1")).toBeInTheDocument();
    expect(toastInfo).toHaveBeenCalledWith("New Notification: Live!");
  });
});
