import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { Event as OpencodeEvent } from "@opencode-ai/sdk";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createIdleHook } from "../../src/hooks/idle.js";
import { makeConfig, makeDedup, makeInput, type MockClient } from "../helpers.js";

function makeIdleEvent(sessionID: string): { event: OpencodeEvent } {
  return {
    event: {
      type: "session.status",
      properties: { sessionID, status: { type: "idle" } },
    } as OpencodeEvent,
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        get: mock(() => Promise.resolve({ data: { id: "s-1", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 0);

    await hook(makeIdleEvent("s-1"));
    await wait(0);

    expect(client.session.get).toHaveBeenCalledWith({ path: { id: "s-1" } });
    expect(client.session.messages).toHaveBeenCalledWith({ path: { id: "s-1" } });
    expect(client.session.todo).toHaveBeenCalledWith({ path: { id: "s-1" } });
  });

  it("ignores session.status with non-idle status", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-1", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 0);

    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-1", status: { type: "busy" } },
      } as OpencodeEvent,
    });

    expect(client.session.get).not.toHaveBeenCalled();
    expect(client.session.messages).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("ignores non-session.status events", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-1", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 0);

    await hook({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "s-1" } },
      } as OpencodeEvent,
    });

    expect(client.session.get).not.toHaveBeenCalled();
    expect(client.session.messages).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("skips notification for background session (parentID exists)", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "background-session-1", parentID: "parent-1" } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 0);

    await hook(makeIdleEvent("background-session-1"));
    await wait(0);

    expect(client.session.get).toHaveBeenCalledWith({ path: { id: "background-session-1" } });
    expect(client.session.messages).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("delays idle notification by configured delayMs", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-delay", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 50);

    await hook(makeIdleEvent("s-delay"));
    expect(sendSpy).not.toHaveBeenCalled();

    await wait(100);
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("cancels notification when session becomes non-idle before delay", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-cancel", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 60_000);

    await hook(makeIdleEvent("s-cancel"));
    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-cancel", status: { type: "busy" } },
      } as OpencodeEvent,
    });
    await wait(0);

    expect(client.session.get).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("cancels and restarts timer on duplicate idle events", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-dup", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 40);

    await hook(makeIdleEvent("s-dup"));
    await wait(20);
    await hook(makeIdleEvent("s-dup"));
    await wait(80);

    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("retry status also cancels pending idle timer", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-retry", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 60_000);

    await hook(makeIdleEvent("s-retry"));
    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-retry", status: { type: "retry" } },
      } as OpencodeEvent,
    });
    await wait(0);

    expect(client.session.get).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("sends idle notification with rich context including session title", async () => {
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
        get: mock(() => Promise.resolve({ data: { id: "s-2", parentID: undefined, title: "Ship feature X" } })),
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

    const hook = createIdleHook(makeInput(client), makeConfig(), dedup, 0);

    await hook(makeIdleEvent("s-2"));
    await wait(0);

    expect(dedupPayload?.type).toBe("idle");
    expect(dedupPayload?.context.sessionTitle).toBe("Ship feature X");
    expect(dedupPayload?.context.userRequest).toBe("Need an update");
    expect(dedupPayload?.context.agentResponse).toBe("Working on it");
    expect(dedupPayload?.context.todoStatus).toContain("in_progress");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("does not send notification for duplicate payload", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-4", parentID: undefined } })),
        messages: mock(() => Promise.resolve({ data: [] })),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(true), 0);

    await hook(makeIdleEvent("s-4"));
    await wait(0);

    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("skips fully-synthetic user messages and finds real user request", async () => {
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
        get: mock(() => Promise.resolve({ data: { id: "s-syn", parentID: undefined } })),
        messages: mock(() =>
          Promise.resolve({ data: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Real user question" }],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Here is the answer" }],
            },
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "[SYSTEM] auto-continuation", synthetic: true }],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Continued working..." }],
            },
          ] })
        ),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), dedup, 0);

    await hook(makeIdleEvent("s-syn"));
    await wait(0);

    expect(dedupPayload?.context.userRequest).toBe("Real user question");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("extracts non-synthetic text from mixed parts", async () => {
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
        get: mock(() => Promise.resolve({ data: { id: "s-mix", parentID: undefined } })),
        messages: mock(() =>
          Promise.resolve({ data: [
            {
              info: { role: "user" },
              parts: [
                { type: "text", text: "Injected system context", synthetic: true },
                { type: "text", text: "What the user actually typed" },
              ],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Response" }],
            },
          ] })
        ),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), dedup, 0);

    await hook(makeIdleEvent("s-mix"));
    await wait(0);

    expect(dedupPayload?.context.userRequest).toBe("What the user actually typed");
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("still sends notification when all messages are synthetic (no real user message found)", async () => {
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-allsyn", parentID: undefined } })),
        messages: mock(() =>
          Promise.resolve({ data: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Auto message 1", synthetic: true }],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Auto response" }],
            },
          ] })
        ),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 0);

    await hook(makeIdleEvent("s-allsyn"));
    await wait(0);

    // No real user request found, so userRequest is undefined, but notification still sends
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("handles client errors without throwing", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const client: MockClient = {
      session: {
        get: mock(() => Promise.resolve({ data: { id: "s-5", parentID: undefined } })),
        messages: mock(() => Promise.reject(new Error("boom"))),
        todo: mock(() => Promise.resolve({ data: [] })),
      },
    };

    const hook = createIdleHook(makeInput(client), makeConfig(), makeDedup(), 0);

    await hook(makeIdleEvent("s-5"));
    await wait(0);

    expect(sendSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
