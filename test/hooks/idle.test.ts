import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event as OpencodeEvent } from "@opencode-ai/sdk";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createIdleHook } from "../../src/hooks/idle.js";

type MockClient = {
  session: {
    messages: ReturnType<typeof mock>;
    todo: ReturnType<typeof mock>;
  };
};

function makeInput(client: MockClient): PluginInput {
  return { client } as unknown as PluginInput;
}

function makeConfig(idleDelayMs: number): PluginConfig {
  return {
    idleDelayMs,
    truncateLength: 1500,
    deduplication: true,
    tag: undefined,
  };
}

function makeDedup(isDuplicateResult: boolean = false): DedupChecker {
  return {
    isDuplicate: mock(() => isDuplicateResult),
    clear: mock(() => {}),
  };
}

describe("createIdleHook", () => {
  const sendSpy = spyOn(notifier, "sendNotification").mockResolvedValue({
    success: true,
    exitCode: 0,
    stderr: "",
  });

  beforeEach(() => {
    sendSpy.mockClear();
  });

  afterEach(() => {
    sendSpy.mockClear();
  });

  it("sets a timer on session.idle", async () => {
    const setTimeoutSpy = spyOn(globalThis, "setTimeout");
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(100), makeDedup());

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-1" } } as OpencodeEvent,
    });

    expect(setTimeoutSpy).toHaveBeenCalled();
    setTimeoutSpy.mockRestore();
  });

  it("sends idle notification after delay", async () => {
    let dedupPayload: NotificationPayload | undefined;
    const dedup: DedupChecker = {
      isDuplicate: mock((payload: NotificationPayload) => {
        dedupPayload = payload;
        return false;
      }),
      clear: mock(() => {}),
    };

    const client: MockClient = {
      session: {
        messages: mock(() =>
          Promise.resolve({
            data: [
              {
                info: { role: "user" },
                parts: [{ type: "text", text: "Need an update" }],
              },
              {
                info: { role: "assistant" },
                parts: [{ type: "text", text: "Working on it" }],
              },
            ],
          })
        ),
        todo: mock(() =>
          Promise.resolve({
            data: [{ id: "1", content: "Ship feature", status: "in_progress", priority: "high" }],
          })
        ),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(0), dedup);

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-2" } } as OpencodeEvent,
    });
    await new Promise((resolve) => setTimeout(resolve, 1));

    expect(dedupPayload?.type).toBe("idle");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("cancels pending idle timer on message.updated", async () => {
    const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(200), makeDedup());

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-3" } } as OpencodeEvent,
    });
    await hook({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "s-3" } },
      } as OpencodeEvent,
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("does not send notification for duplicate payload", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(0), makeDedup(true));

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-4" } } as OpencodeEvent,
    });
    await new Promise((resolve) => setTimeout(resolve, 1));

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("handles client errors without throwing", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.reject(new Error("boom"))),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(0), makeDedup());

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-5" } } as OpencodeEvent,
    });
    await new Promise((resolve) => setTimeout(resolve, 1));

    expect(sendSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
