import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* * React Compiler (Stable in 16.2)
   * Automatically optimizes components. No more manual useMemo/useCallback!
   */
  reactCompiler: true,

  /* * Cache Components (Replaces experimental.ppr and experimental.dynamicIO)
   * Enables the "use cache" directive for high-performance edge caching.
   */
  cacheComponents: true,

  /* * Allow 127.0.0.1 and localhost as dev origins so Playwright and local browser
   * can load HMR / RSC chunks without being blocked. No effect in prod.
   */
  allowedDevOrigins: ["127.0.0.1", "localhost"],

  images: {
    /* * Cloudflare Pages does not support the default Node.js image resizer.
     * Setting this to 'unoptimized' allows the Cloudflare CDN to handle assets.
     */
    unoptimized: true,
  },

  logging: {
    fetches: {
      fullUrl: true,
    },
    /* * New in 16.2: Forwards browser console errors directly to your 
     * Beelink terminal during development.
     */
    browserToTerminal: true,
  },

  experimental: {
    /* * Provides IntelliSense for your .env variables (Supabase URL/Key)
     * so you get autocomplete and type-checking in your code.
     */
    typedEnv: true,
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const isLocalDb =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("localhost") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1");

    const connectSrc =
      isDev || isLocalDb
        ? "connect-src 'self' https: wss: http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*;"
        : "connect-src 'self' https: wss:;";

    const cspDirectives = [
      "default-src 'self';",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
      "font-src 'self' data: https://fonts.gstatic.com;",
      "img-src 'self' data: blob: https:;",
      connectSrc,
      "frame-ancestors 'none';",
      "object-src 'none';",
      "base-uri 'self';",
    ].join(" ");

    return [
      {
        source: "/:path*",
        headers: [
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]),
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
        ],
      },
    ];
  },
};

export default nextConfig;