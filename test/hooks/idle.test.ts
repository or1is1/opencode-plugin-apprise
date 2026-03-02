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
    todos: ReturnType<typeof mock>;
  };
};

function makeInput(client: MockClient): PluginInput {
  return { client } as unknown as PluginInput;
}

function makeConfig(): PluginConfig {
  return {
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

  it("fetches session data on session.idle", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve([])),
        todos: mock(() => Promise.resolve([])),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup());

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-1" } } as OpencodeEvent,
    });

    expect(client.session.messages).toHaveBeenCalledWith({ path: { id: "s-1" } });
    expect(client.session.todos).toHaveBeenCalledWith({ path: { id: "s-1" } });
  });

  it("sends idle notification immediately", async () => {
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
          Promise.resolve([
            {
              role: "user",
              content: [{ text: "Need an update" }],
            },
            {
              role: "assistant",
              content: [{ text: "Working on it" }],
            },
          ])
        ),
        todos: mock(() =>
          Promise.resolve([
            { content: "Ship feature", status: "in_progress" },
          ])
        ),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), dedup);

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-2" } } as OpencodeEvent,
    });

    expect(dedupPayload?.type).toBe("idle");
    expect(dedupPayload?.context.userRequest).toBe("Need an update");
    expect(dedupPayload?.context.agentResponse).toBe("Working on it");
    expect(dedupPayload?.context.todoStatus).toContain("in_progress");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("does not send notification for duplicate payload", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve([])),
        todos: mock(() => Promise.resolve([])),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(true));

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-4" } } as OpencodeEvent,
    });

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("handles client errors without throwing", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.reject(new Error("boom"))),
        todos: mock(() => Promise.resolve([])),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup());

    await hook({
      event: { type: "session.idle", properties: { sessionID: "s-5" } } as OpencodeEvent,
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
