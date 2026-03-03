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

function makeIdleEvent(sessionID: string): { event: OpencodeEvent } {
  return {
    event: {
      type: "session.status",
      properties: { sessionID, status: { type: "idle" } },
    } as OpencodeEvent,
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

  it("fetches session data on session.status with idle status", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const interactiveSessions = new Set(["s-1"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), interactiveSessions);

    await hook(makeIdleEvent("s-1"));

    expect(client.session.messages).toHaveBeenCalledWith({ path: { id: "s-1" } });
    expect(client.session.todo).toHaveBeenCalledWith({ path: { id: "s-1" } });
  });

  it("ignores session.status with non-idle status", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const interactiveSessions = new Set(["s-1"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), interactiveSessions);

    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-1", status: { type: "busy" } },
      } as OpencodeEvent,
    });

    expect(client.session.messages).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("ignores non-session.status events", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const interactiveSessions = new Set(["s-1"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), interactiveSessions);

    await hook({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "s-1" } },
      } as OpencodeEvent,
    });

    expect(client.session.messages).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("ignores idle events for non-interactive (background) sessions", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const interactiveSessions = new Set<string>(); // empty — no foreground sessions
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), interactiveSessions);

    await hook(makeIdleEvent("background-session-1"));

    expect(client.session.messages).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("sends notification only for sessions tracked as interactive", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const interactiveSessions = new Set(["fg-1"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), interactiveSessions);

    // Background session — should be ignored
    await hook(makeIdleEvent("bg-1"));
    expect(sendSpy).not.toHaveBeenCalled();

    // Foreground session — should send
    await hook(makeIdleEvent("fg-1"));
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("sends idle notification with rich context", async () => {
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
          Promise.resolve({ data: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Need an update" }],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Working on it" }],
            },
          ] })
        ),
        todo: mock(() =>
          Promise.resolve({ data: [
            { content: "Ship feature", status: "in_progress" },
          ] })
        ),
      },
    };

    const interactiveSessions = new Set(["s-2"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), dedup, interactiveSessions);

    await hook(makeIdleEvent("s-2"));

    expect(dedupPayload?.type).toBe("idle");
    expect(dedupPayload?.context.userRequest).toBe("Need an update");
    expect(dedupPayload?.context.agentResponse).toBe("Working on it");
    expect(dedupPayload?.context.todoStatus).toContain("in_progress");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("does not send notification for duplicate payload", async () => {
    const client: MockClient = {
      session: {
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const interactiveSessions = new Set(["s-4"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(true), interactiveSessions);

    await hook(makeIdleEvent("s-4"));

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

    const interactiveSessions = new Set(["s-5"]);
    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), interactiveSessions);

    await hook(makeIdleEvent("s-5"));

    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
