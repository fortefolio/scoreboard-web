export const PROTECTED_PREFIXES = [
  "/my-matches",
  "/my-tournaments",
  "/notifications",
  "/settings",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
