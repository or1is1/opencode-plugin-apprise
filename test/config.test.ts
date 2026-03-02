import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, validateConfig } from "../src/config.js";
import type { PluginConfig } from "../src/types.js";

describe("Config Module", () => {
  // Store original env vars to restore after each test
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.APPRISE_URLS;
    delete process.env.APPRISE_CONFIG;
    delete process.env.OPENCODE_NOTIFY_IDLE_DELAY;
    delete process.env.OPENCODE_NOTIFY_TRUNCATE;
    delete process.env.OPENCODE_NOTIFY_DEDUP;
    delete process.env.OPENCODE_NOTIFY_TAG;
  });

  afterEach(() => {
    // Restore original env vars
    Object.assign(process.env, originalEnv);
  });

  describe("loadConfig()", () => {
    it("should load APPRISE_URLS from env (comma-separated → array)", () => {
      process.env.APPRISE_URLS = "apprise://service1/token1,apprise://service2/token2";

      const config = loadConfig();

      expect(config.appriseUrls).toEqual([
        "apprise://service1/token1",
        "apprise://service2/token2",
      ]);
    });

    it("should load APPRISE_URLS from env (space-separated → array)", () => {
      process.env.APPRISE_URLS = "apprise://service1/token1 apprise://service2/token2";

      const config = loadConfig();

      expect(config.appriseUrls).toEqual([
        "apprise://service1/token1",
        "apprise://service2/token2",
      ]);
    });

    it("should apply default values when env vars not set", () => {
      // Don't set any env vars
      const config = loadConfig();

      expect(config.appriseUrls).toEqual([]);
      expect(config.appriseConfigPath).toBeUndefined();
      expect(config.idleDelayMs).toBe(3000);
      expect(config.truncateLength).toBe(1500);
      expect(config.deduplication).toBe(true);
      expect(config.tag).toBeUndefined();
    });

    it("should load APPRISE_CONFIG from env", () => {
      process.env.APPRISE_CONFIG = "/path/to/apprise/config";

      const config = loadConfig();

      expect(config.appriseConfigPath).toBe("/path/to/apprise/config");
    });

    it("should load OPENCODE_NOTIFY_IDLE_DELAY from env", () => {
      process.env.OPENCODE_NOTIFY_IDLE_DELAY = "5000";

      const config = loadConfig();

      expect(config.idleDelayMs).toBe(5000);
    });

    it("should load OPENCODE_NOTIFY_TRUNCATE from env", () => {
      process.env.OPENCODE_NOTIFY_TRUNCATE = "2000";

      const config = loadConfig();

      expect(config.truncateLength).toBe(2000);
    });

    it("should load OPENCODE_NOTIFY_TAG from env", () => {
      process.env.OPENCODE_NOTIFY_TAG = "my-custom-tag";

      const config = loadConfig();

      expect(config.tag).toBe("my-custom-tag");
    });

    it("should handle OPENCODE_NOTIFY_DEDUP=false", () => {
      process.env.OPENCODE_NOTIFY_DEDUP = "false";

      const config = loadConfig();

      expect(config.deduplication).toBe(false);
    });

    it("should treat OPENCODE_NOTIFY_DEDUP=true as true", () => {
      process.env.OPENCODE_NOTIFY_DEDUP = "true";

      const config = loadConfig();

      expect(config.deduplication).toBe(true);
    });

    it("should filter empty strings from APPRISE_URLS", () => {
      process.env.APPRISE_URLS = "apprise://service1/token1,,apprise://service2/token2";

      const config = loadConfig();

      expect(config.appriseUrls).toEqual([
        "apprise://service1/token1",
        "apprise://service2/token2",
      ]);
    });
  });

  describe("validateConfig()", () => {
    it("should throw when both APPRISE_URLS and APPRISE_CONFIG are missing", () => {
      const config: PluginConfig = {
        appriseUrls: [],
        appriseConfigPath: undefined,
        idleDelayMs: 3000,
        truncateLength: 1500,
        deduplication: true,
        tag: undefined,
      };

      expect(() => validateConfig(config)).toThrow(
        "APPRISE_URLS or APPRISE_CONFIG must be set"
      );
    });

    it("should pass when APPRISE_URLS is set", () => {
      const config: PluginConfig = {
        appriseUrls: ["apprise://service/token"],
        appriseConfigPath: undefined,
        idleDelayMs: 3000,
        truncateLength: 1500,
        deduplication: true,
        tag: undefined,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it("should pass when APPRISE_CONFIG is set (even without APPRISE_URLS)", () => {
      const config: PluginConfig = {
        appriseUrls: [],
        appriseConfigPath: "/path/to/config",
        idleDelayMs: 3000,
        truncateLength: 1500,
        deduplication: true,
        tag: undefined,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });

    it("should pass when both APPRISE_URLS and APPRISE_CONFIG are set", () => {
      const config: PluginConfig = {
        appriseUrls: ["apprise://service/token"],
        appriseConfigPath: "/path/to/config",
        idleDelayMs: 3000,
        truncateLength: 1500,
        deduplication: true,
        tag: undefined,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});
