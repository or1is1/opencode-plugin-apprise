import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import plugin from "../src/index.js";
import * as notifier from "../src/notifier.js";

const ENV_KEYS = [] as const;

const originalEnv = new Map<string, string | undefined>();
for (const key of ENV_KEYS) {
  originalEnv.set(key, process.env[key]);
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

function makePluginInput(): PluginInput {
  const input = {
    client: {
      session: {
        messages: async () => ({ data: [] }),
        todo: async () => ({ data: [] }),
      },
    },
    project: {},
    directory: "/tmp",
    worktree: "/tmp",
    serverUrl: new URL("http://localhost"),
    $: {},
  };

  return input as unknown as PluginInput;
}

describe("Plugin Entrypoint", () => {
  afterEach(() => {
    restoreEnv();
    mock.restore();
  });

  it("exports plugin as a function", () => {
    expect(typeof plugin).toBe("function");
  });

  it("returns empty hooks when apprise is not installed", async () => {
    const checkSpy = spyOn(notifier, "checkAppriseInstalled").mockResolvedValue(false);
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const hooks = await plugin(makePluginInput());

    expect(checkSpy).toHaveBeenCalledTimes(1);
    expect(hooks).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
  });

  it("returns all expected hooks when config is valid and apprise is installed", async () => {
    spyOn(notifier, "checkAppriseInstalled").mockResolvedValue(true);

    const hooks = await plugin(makePluginInput());

    expect(typeof hooks.event).toBe("function");
    expect(typeof hooks["tool.execute.before"]).toBe("function");
    expect(typeof hooks["tool.execute.after"]).toBe("function");
    expect(typeof hooks["permission.ask"]).toBe("function");
  });

  it("includes all required hook keys", async () => {
    spyOn(notifier, "checkAppriseInstalled").mockResolvedValue(true);

    const hooks = await plugin(makePluginInput());

    expect("event" in hooks).toBe(true);
    expect("tool.execute.before" in hooks).toBe(true);
    expect("tool.execute.after" in hooks).toBe(true);
    expect("permission.ask" in hooks).toBe(true);
  });
});
