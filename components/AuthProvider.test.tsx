import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseMock } from "@/tests/helpers/supabase-mock";

const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
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

// Imports must come *after* the vi.mock calls so they pick up the mocks.
import { AuthProvider, useAuth } from "./AuthProvider";

const testUser = { id: "user-1", email: "alice@example.com" } as unknown as User;

const wrapper =
  (initialUser: User | null = null) =>
  ({ children }: { children: React.ReactNode }) => (
    <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
  );

describe("AuthProvider", () => {
  beforeEach(() => {
    routerRefresh.mockClear();
  });

  it("exposes the initial user via useAuth", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(testUser) });
    expect(result.current.user).toEqual(testUser);
  });

  it("starts with null when no initial user is provided", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(null) });
    expect(result.current.user).toBeNull();
  });

  it("updates the user when onAuthStateChange fires SIGNED_IN, and calls router.refresh", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(null) });
    expect(result.current.user).toBeNull();

    act(() => {
      supabaseMock.__emit("SIGNED_IN", {
        user: testUser,
        access_token: "t",
        refresh_token: "r",
      } as never);
    });

    expect(result.current.user).toEqual(testUser);
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("clears the user when onAuthStateChange fires SIGNED_OUT, and calls router.refresh", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(testUser) });

    act(() => {
      supabaseMock.__emit("SIGNED_OUT", null);
    });

    expect(result.current.user).toBeNull();
    expect(routerRefresh).toHaveBeenCalledTimes(1);
  });

  it("ignores TOKEN_REFRESHED with a valid session (no refresh, no user change)", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(testUser) });
    routerRefresh.mockClear();

    act(() => {
      supabaseMock.__emit("TOKEN_REFRESHED", {
        user: testUser,
        access_token: "new",
        refresh_token: "new",
      } as never);
    });

    expect(result.current.user).toEqual(testUser);
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it("signOut delegates to supabase.auth.signOut", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrapper(testUser) });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabaseMock.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("provides a stable supabase client reference across renders", () => {
    const { result, rerender } = renderHook(() => useAuth(), { wrapper: wrapper(testUser) });
    const first = result.current.supabase;
    rerender();
    expect(result.current.supabase).toBe(first);
  });

  it("renders children", () => {
    render(
      <AuthProvider initialUser={null}>
        <span data-testid="child">hello</span>
      </AuthProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });
});

describe("useAuth", () => {
  it("throws a clear error when used outside <AuthProvider>", () => {
    // renderHook surfaces hook errors through the error boundary; suppress the React console noise.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(/must be used inside <AuthProvider>/);
    consoleError.mockRestore();
  });
});
