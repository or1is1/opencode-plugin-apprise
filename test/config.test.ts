import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, validateConfig } from "../src/config.js";
import type { PluginConfig } from "../src/types.js";

describe("Config Module", () => {
  beforeEach(() => {
    // Clear relevant env vars before each test
    delete process.env.OPENCODE_NOTIFY_TAG;
  });

  afterEach(() => {
    // Restore original env vars
    Object.assign(process.env, originalEnv);
  });

  describe("loadConfig()", () => {
    it("should return minimal config with optional tag from env", () => {
      // Don't set any env vars
      const config = loadConfig();

      expect(config).toEqual({
        tag: undefined,
      });
    });

    it("should load OPENCODE_NOTIFY_TAG from env", () => {
      process.env.OPENCODE_NOTIFY_TAG = "my-custom-tag";

      const config = loadConfig();

      expect(config.tag).toBe("my-custom-tag");
    });
  });

  describe("validateConfig()", () => {
    it("should not throw for a valid config object", () => {
      const config: PluginConfig = {
        tag: undefined,
      };

      expect(() => validateConfig(config)).not.toThrow();
    });
  });
});

// Store original env vars to restore after each test
const originalEnv = { ...process.env };
