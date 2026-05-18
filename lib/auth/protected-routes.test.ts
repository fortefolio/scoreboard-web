import { describe, expect, it } from "vitest";
import { isProtectedPath, PROTECTED_PREFIXES } from "@/lib/auth/protected-routes";

describe("isProtectedPath", () => {
  it("matches an exact protected prefix", () => {
    expect(isProtectedPath("/my-matches")).toBe(true);
    expect(isProtectedPath("/my-tournaments")).toBe(true);
    expect(isProtectedPath("/notifications")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
  });

  it("matches a nested path under a protected prefix", () => {
    expect(isProtectedPath("/my-matches/abc")).toBe(true);
    expect(isProtectedPath("/settings/profile/avatar")).toBe(true);
  });

  it("does not match a path that only shares the prefix without a slash boundary", () => {
    // /my-matches-public should NOT count as protected even though it starts with /my-matches
    expect(isProtectedPath("/my-matches-public")).toBe(false);
    expect(isProtectedPath("/settings-help")).toBe(false);
  });

  it("does not match public paths", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/tournament/abc")).toBe(false);
    expect(isProtectedPath("/match/123")).toBe(false);
    expect(isProtectedPath("/match/123/scoreboard")).toBe(false);
  });

  it("does not match an empty string", () => {
    expect(isProtectedPath("")).toBe(false);
  });

  it("treats the configured PROTECTED_PREFIXES list as the single source of truth", () => {
    expect(PROTECTED_PREFIXES).toContain("/my-matches");
    expect(PROTECTED_PREFIXES).toContain("/my-tournaments");
    expect(PROTECTED_PREFIXES).toContain("/notifications");
    expect(PROTECTED_PREFIXES).toContain("/settings");
  });
});
