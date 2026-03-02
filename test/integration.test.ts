import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import { loadConfig } from "../src/config.js";
import { createDedupChecker } from "../src/dedup.js";
import { formatNotification, formatTodoStatus } from "../src/formatter.js";
import plugin from "../src/index.js";
import * as notifier from "../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../src/types.js";

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
        todos: async () => ({ data: [] }),
      },
    },
    project: {},
    directory: "",
    worktree: "",
    serverUrl: new URL("http://localhost"),
    $: {},
  };

  return input as unknown as PluginInput;
}

describe("Integration + Edge Cases", () => {
  afterEach(() => {
    restoreEnv();
    mock.restore();
  });

  it("full plugin initialization flow returns all expected hooks", async () => {
    spyOn(notifier, "checkAppriseInstalled").mockResolvedValue(true);

    const hooks = await plugin(makePluginInput());

    expect(typeof hooks.event).toBe("function");
    expect(typeof hooks["tool.execute.before"]).toBe("function");
    expect(typeof hooks["tool.execute.after"]).toBe("function");
    expect(typeof hooks["permission.ask"]).toBe("function");
  });

  it("plugin gracefully disables when apprise is not installed", async () => {
    spyOn(notifier, "checkAppriseInstalled").mockResolvedValue(false);
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const hooks = await plugin(makePluginInput());

    expect(hooks).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
  });

  it("preserves Unicode Korean text and truncates multi-byte content safely", () => {
    const korean = "안녕하세요 OpenCode 에이전트입니다";
    const payload: NotificationPayload = {
      type: "idle",
      title: "unicode",
      context: {
        userRequest: korean,
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };

    const formatted = formatNotification(payload, 200);
    expect(formatted.body).toContain(korean);

    const longKoreanPayload: NotificationPayload = {
      ...payload,
      context: {
        ...payload.context,
        userRequest: korean.repeat(300),
      },
    };
    const truncated = formatNotification(longKoreanPayload, 150);

    expect(truncated.body.length).toBeLessThanOrEqual(150);
    expect(truncated.body).toContain("...(truncated)");
  });

  it("treats shell-looking input as plain text in formatter output", () => {
    const malicious = "$(rm -rf /); echo pwned";
    const payload: NotificationPayload = {
      type: "question",
      title: "security",
      context: {
        userRequest: undefined,
        agentResponse: undefined,
        question: malicious,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };

    const formatted = formatNotification(payload);
    expect(formatted.body).toContain(malicious);
  });

  it("truncates very long messages to configured length", () => {
    const veryLong = "x".repeat(3000);
    const payload: NotificationPayload = {
      type: "idle",
      title: "long",
      context: {
        userRequest: veryLong,
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };

    const formatted = formatNotification(payload, 1500);
    expect(formatted.body.length).toBeLessThanOrEqual(1500);
    expect(formatted.body).toContain("...(truncated)");
  });

  it("handles empty context fields without crashing", () => {
    const payload: NotificationPayload = {
      type: "idle",
      title: "empty",
      context: {
        userRequest: undefined,
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };

    expect(() => formatNotification(payload)).not.toThrow();
    const formatted = formatNotification(payload);
    expect(formatted.body).toBe("");
  });

  it("dedup checker + formatter integration only notifies once for duplicate payload", async () => {
    const dedup = createDedupChecker();
    const sendSpy = spyOn(notifier, "sendNotification").mockResolvedValue({
      success: true,
      exitCode: 0,
      stderr: "",
    });

    const config: PluginConfig = {
      tag: undefined,
    };

    const payload: NotificationPayload = {
      type: "background",
      title: "✅ Background Task Complete",
      context: {
        userRequest: undefined,
        agentResponse: "completed",
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: "Session s-1",
        toolName: undefined,
        action: undefined,
      },
    };

    const firstDuplicate = dedup.isDuplicate(payload);
    if (!firstDuplicate) {
      await notifier.sendNotification(config, formatNotification(payload));
    }

    const secondDuplicate = dedup.isDuplicate(payload);
    if (!secondDuplicate) {
      await notifier.sendNotification(config, formatNotification(payload));
    }

    expect(firstDuplicate).toBe(false);
    expect(secondDuplicate).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("loads defaults with no optional notification env vars", () => {
    const config = loadConfig();

    expect(config.tag).toBeUndefined();
  });

  it("formats todo status with completed, in-progress, pending, and ignores cancelled", () => {
    const status = formatTodoStatus([
      { status: "completed", content: "task 1" },
      { status: "in_progress", content: "task 2" },
      { status: "pending", content: "task 3" },
      { status: "cancelled", content: "task 4" },
    ]);

    expect(status).toBe("✅ 1 done | ▶️ 1 in_progress | ⚪ 1 pending");
  });
});
