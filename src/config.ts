import type { PluginConfig } from "./types.js";

/**
 * Load plugin configuration from environment variables.
 *
 * Environment variables:
 * - APPRISE_URLS: Comma or space-separated list of Apprise URLs (takes priority over CLI URLs)
 * - APPRISE_CONFIG: Path to Apprise config file
 * - OPENCODE_NOTIFY_IDLE_DELAY: Idle delay in milliseconds (default: 3000)
 * - OPENCODE_NOTIFY_TRUNCATE: Truncate notification body to this length (default: 1500)
 * - OPENCODE_NOTIFY_DEDUP: Enable deduplication (default: true)
 * - OPENCODE_NOTIFY_TAG: Optional tag for notifications
 */
export function loadConfig(): PluginConfig {
  // Read APPRISE_URLS from environment and split by comma or space
  const appriseUrlsRaw = process.env.APPRISE_URLS ?? "";
  const appriseUrls = appriseUrlsRaw
    ? appriseUrlsRaw.split(/[\s,]+/).filter(Boolean)
    : [];

  return {
    appriseUrls,
    appriseConfigPath: process.env.APPRISE_CONFIG,
    idleDelayMs: parseInt(process.env.OPENCODE_NOTIFY_IDLE_DELAY ?? "3000", 10),
    truncateLength: parseInt(process.env.OPENCODE_NOTIFY_TRUNCATE ?? "1500", 10),
    deduplication: (process.env.OPENCODE_NOTIFY_DEDUP ?? "true") !== "false",
    tag: process.env.OPENCODE_NOTIFY_TAG,
  };
}

/**
 * Validate plugin configuration.
 *
 * Throws an error if neither APPRISE_URLS nor APPRISE_CONFIG is set.
 */
export function validateConfig(config: PluginConfig): void {
  if (config.appriseUrls.length === 0 && !config.appriseConfigPath) {
    throw new Error(
      "APPRISE_URLS or APPRISE_CONFIG must be set. " +
        "Set APPRISE_URLS to a comma-separated list of Apprise URLs, " +
        "or APPRISE_CONFIG to the path of an Apprise config file."
    );
  }
}
