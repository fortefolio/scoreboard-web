import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSupabaseMock } from "@/tests/helpers/supabase-mock";

const routerPush = vi.fn();
const routerReplace = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
  usePathname: () => "/",
  useParams: () => ({}),
}));

const supabaseMock = createSupabaseMock();
vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => supabaseMock,
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
const toastInfo = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
    info: (...args: unknown[]) => toastInfo(...args),
  },
}));

import { AuthProvider } from "@/components/AuthProvider";
import Home from "./page";

const renderHome = async () => {
  const result = render(
    <AuthProvider initialUser={null}>
      <Home />
    </AuthProvider>
  );
  // Let initial fetchLiveMatches / fetchFeaturedTournaments effects settle to
  // avoid act() warnings about post-render state updates.
  await waitFor(() => expect(supabaseMock.from).toHaveBeenCalled());
  return result;
};

const resetState = () => {
  searchParams = new URLSearchParams();
  supabaseMock.__resetResponses();
  supabaseMock.auth.signInWithPassword.mockClear();
  supabaseMock.auth.signUp.mockClear();
  supabaseMock.auth.signInWithPassword.mockImplementation(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  );
  supabaseMock.auth.signUp.mockImplementation(() =>
    Promise.resolve({ data: { user: null, session: null }, error: null })
  );
  routerPush.mockClear();
  routerReplace.mockClear();
  toastError.mockClear();
  toastSuccess.mockClear();
  toastInfo.mockClear();
};

describe("Home — auth modal visibility", () => {
  beforeEach(resetState);

  it("does not show the modal when no ?auth= param is set", async () => {
    await renderHome();
    expect(screen.queryByPlaceholderText(/enter your email/i)).not.toBeInTheDocument();
  });

  it("shows the login modal when ?auth=login", async () => {
    searchParams = new URLSearchParams({ auth: "login" });
    await renderHome();
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/choose a username/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
  });

  it("shows the signup modal with username + confirm password when ?auth=signup", async () => {
    searchParams = new URLSearchParams({ auth: "signup" });
    await renderHome();
    expect(screen.getByPlaceholderText(/choose a username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm your password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^sign up$/i })).toBeInTheDocument();
  });
});

describe("Home — signup validation", () => {
  beforeEach(resetState);

  it("rejects an empty username with a toast and no API call", async () => {
    searchParams = new URLSearchParams({ auth: "signup" });
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "password123");
    await user.type(screen.getByPlaceholderText(/confirm your password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(toastError).toHaveBeenCalledWith("Username is required");
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords with a toast and no API call", async () => {
    searchParams = new URLSearchParams({ auth: "signup" });
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/choose a username/i), "alice");
    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "password123");
    await user.type(screen.getByPlaceholderText(/confirm your password/i), "different456");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(toastError).toHaveBeenCalledWith("Passwords do not match");
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });

  it("rejects an already-taken username (uniqueness check returns a row)", async () => {
    searchParams = new URLSearchParams({ auth: "signup" });
    // Username check: maybeSingle() returns { data: existing, error: null }
    supabaseMock.__queueResponse("users", { data: { id: "existing-user" }, error: null });
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/choose a username/i), "alice");
    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "password123");
    await user.type(screen.getByPlaceholderText(/confirm your password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Username already taken. Please choose another one.")
    );
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("Home — happy paths", () => {
  beforeEach(resetState);

  it("calls signUp with display_name metadata when username is free", async () => {
    searchParams = new URLSearchParams({ auth: "signup" });
    // Username check returns no row → uniqueness passes
    supabaseMock.__queueResponse("users", { data: null, error: null });
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/choose a username/i), "  alice  ");
    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "password123");
    await user.type(screen.getByPlaceholderText(/confirm your password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    await waitFor(() => expect(supabaseMock.auth.signUp).toHaveBeenCalled());
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "password123",
      options: { data: { display_name: "alice" } },
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalled());
  });

  it("logs in and redirects to ?next= when present", async () => {
    searchParams = new URLSearchParams({ auth: "login", next: "/my-matches" });
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() =>
      expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "password123",
      })
    );
    await waitFor(() => expect(routerPush).toHaveBeenCalledWith("/my-matches"));
    expect(toastSuccess).toHaveBeenCalledWith("Welcome back!");
  });

  it("does not navigate after login when no ?next= is present", async () => {
    searchParams = new URLSearchParams({ auth: "login" });
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "password123");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalled());
    expect(routerPush).not.toHaveBeenCalled();
  });
});

describe("Home — auth errors", () => {
  beforeEach(resetState);

  it("surfaces the supabase error message and keeps the modal open", async () => {
    searchParams = new URLSearchParams({ auth: "login" });
    supabaseMock.auth.signInWithPassword.mockImplementationOnce(() =>
      Promise.resolve({ data: { user: null, session: null }, error: { message: "Invalid login credentials" } as any })
    );
    const user = userEvent.setup();
    await renderHome();

    await user.type(screen.getByPlaceholderText(/enter your email/i), "alice@example.com");
    await user.type(screen.getByPlaceholderText(/enter your password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Invalid login credentials"));
    // Modal still mounted
    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
  });
});

describe("Home — modal toggling", () => {
  beforeEach(resetState);

  it("toggles login → signup via the footer link", async () => {
    searchParams = new URLSearchParams({ auth: "login" });
    const user = userEvent.setup();
    await renderHome();
    expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();

    // Footer toggle: "Don't have an account? Sign Up"
    await user.click(screen.getByRole("button", { name: /^sign up$/i }));

    expect(screen.getByPlaceholderText(/choose a username/i)).toBeInTheDocument();
  });
});
