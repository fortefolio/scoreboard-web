// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

export default defineCloudflareConfig({
  // The 'platform' and 'middleware' keys are no longer required in 16.2.1
  incrementalCache: kvIncrementalCache,
});