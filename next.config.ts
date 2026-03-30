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
};

export default nextConfig;