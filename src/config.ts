import type { PluginConfig } from "./types.js";

/**
 * Load minimal plugin configuration.
 * All behavior handled by Apprise defaults — no environment variables.
 */
export function loadConfig(): PluginConfig {
  return {
    tag: process.env.OPENCODE_NOTIFY_TAG,
  };
}

/**
 * Validate plugin configuration (no-op — no required fields).
 */
export function validateConfig(_config: PluginConfig): void {
}
