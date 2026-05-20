// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { CookieMethodsServer } from "@supabase/ssr";

// --- Supabase mock ---------------------------------------------------------
// Capture the cookie handlers passed to createServerClient so tests can
// trigger setAll directly. Also control what auth.getUser() returns.

let capturedCookies: CookieMethodsServer | null = null;
const getUserMock = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url: string, _key: string, options: { cookies: CookieMethodsServer }) => {
    capturedCookies = options.cookies;
    return {
      auth: { getUser: getUserMock },
    };
  }),
}));

// Imports must come after the vi.mock call.
import { updateSession } from "./proxy";

// --- Helpers ---------------------------------------------------------------

const makeRequest = (
  pathname: string,
  options: { authCookie?: boolean; baseUrl?: string } = {}
) => {
  const url = `${options.baseUrl ?? "http://localhost:3000"}${pathname}`;
  const headers = new Headers();
  if (options.authCookie) {
    headers.set("cookie", "sb-access-token=test-token");
  }
  return new NextRequest(url, { headers });
};

const stubGuest = () => {
  getUserMock.mockResolvedValue({ data: { user: null }, error: null });
};

const stubAuthed = (id = "user-1") => {
  getUserMock.mockResolvedValue({ data: { user: { id, email: "alice@example.com" } }, error: null });
};

describe("updateSession — protected route guard", () => {
  beforeEach(() => {
    capturedCookies = null;
    getUserMock.mockReset();
  });

  it.each([
    "/my-matches",
    "/my-tournaments",
    "/notifications",
    "/settings",
  ])("redirects a guest from %s to /?auth=login&next=<path>", async (path) => {
    stubGuest();
    const res = await updateSession(makeRequest(path));

    expect(res.status).toBe(307);
    const location = res.headers.get("location")!;
    const url = new URL(location);
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("auth")).toBe("login");
    expect(url.searchParams.get("next")).toBe(path);
  });

  it("redirects a guest from a nested protected path and preserves the original path in ?next=", async () => {
    stubGuest();
    const res = await updateSession(makeRequest("/my-tournaments/abc-123"));

    expect(res.status).toBe(307);
    const url = new URL(res.headers.get("location")!);
    expect(url.searchParams.get("next")).toBe("/my-tournaments/abc-123");
  });

  it("does NOT redirect a guest from a public path", async () => {
    stubGuest();
    const res = await updateSession(makeRequest("/tournament/abc"));

    // NextResponse.next() returns 200 with rsc/cookie headers; we only check
    // that it's not a 3xx Location-bearing response.
    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT redirect for a path that only shares a prefix with a protected route", async () => {
    // /my-matches-public should NOT count as protected even though it
    // starts with /my-matches (pinned by isProtectedPath).
    stubGuest();
    const res = await updateSession(makeRequest("/my-matches-public"));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes an authenticated user through to a protected path", async () => {
    stubAuthed();
    const res = await updateSession(makeRequest("/my-matches"));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes an authenticated user through to a public path", async () => {
    stubAuthed();
    const res = await updateSession(makeRequest("/tournament/abc"));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("updateSession — cookie refresh", () => {
  beforeEach(() => {
    capturedCookies = null;
    getUserMock.mockReset();
  });

  it("setAll mirrors supabase-driven cookie writes onto the outgoing response", async () => {
    stubGuest();
    // Trigger updateSession; while running, we'll invoke setAll on the captured handler.
    // To simulate the supabase client writing fresh tokens, we hook into the cookie
    // handlers before getUser resolves.
    getUserMock.mockImplementation(async () => {
      capturedCookies!.setAll(
        [
          { name: "sb-refresh", value: "new-refresh", options: { path: "/", httpOnly: true } },
          { name: "sb-access", value: "new-access", options: { path: "/" } },
        ],
        { "Cache-Control": "no-store" }
      );
      return { data: { user: null }, error: null };
    });

    const res = await updateSession(makeRequest("/tournament/abc"));

    // Response should carry both refreshed cookies and the security headers
    // setAll's headers arg passed in.
    const setCookieHeader = res.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain("sb-refresh=new-refresh");
    expect(setCookieHeader).toContain("sb-access=new-access");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("getAll exposes the request's incoming cookies to the supabase client", async () => {
    stubGuest();
    let observed: { name: string; value: string }[] = [];
    getUserMock.mockImplementation(async () => {
      observed = capturedCookies!.getAll!() as { name: string; value: string }[];
      return { data: { user: null }, error: null };
    });

    const req = makeRequest("/", { authCookie: true });
    await updateSession(req);

    expect(observed.find(c => c.name === "sb-access-token")?.value).toBe("test-token");
  });
});
