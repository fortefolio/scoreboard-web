// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // This replaces the need for 'adapterPath' in next.config.ts
  platform: 'cloudflare',
  
  // High-performance caching for your Scoreboard
  incrementalCache: true, 

  // Configuration for your Edge Middleware
  middleware: {
    external: true,
  },
});