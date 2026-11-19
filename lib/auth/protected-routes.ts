export const PROTECTED_PREFIXES = [
  "/my-matches",
  "/my-tournaments",
  "/umpire-matches",
  "/notifications",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
