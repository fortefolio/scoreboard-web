import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { isProtectedPath } from "@/lib/auth/protected-routes";

const SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
};

function applySecurityHeaders(res: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (!res.headers.has(key)) {
      res.headers.set(key, value);
    }
  });
  return res;
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers ?? {}).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && isProtectedPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth", "login");
    redirectUrl.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return applySecurityHeaders(redirectResponse);
  }

  // Enforce private caching on cookie-authenticated requests to prevent edge KV / CDN cross-tenant caching
  if (!response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  }
  if (!response.headers.has("Vary")) {
    response.headers.set("Vary", "Cookie");
  }

  return applySecurityHeaders(response);
}
