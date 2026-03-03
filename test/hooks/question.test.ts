import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event as OpencodeEvent } from "@opencode-ai/sdk";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createQuestionHook } from "../../src/hooks/question.js";

type MockClient = {
  session: {
    get: ReturnType<typeof mock>;
  };
};

function makeInput(client: MockClient): PluginInput {
  return { client } as unknown as PluginInput;
}

function makeDefaultInput(title: string = "Test Session"): PluginInput {
  const client: MockClient = {
    session: {
      get: mock(() => Promise.resolve({ data: { title } })),
    },
  };
  return makeInput(client);
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

function makeQuestionAskedEvent(
  id: string,
  question: string,
  options: Array<{ label: string; description: string }> = [],
): { event: OpencodeEvent } {
  return {
    event: {
      type: "question.asked",
      properties: {
        id,
        sessionID: "s-1",
        questions: [{ question, header: "Choose", options }],
      },
    } as OpencodeEvent,
  };
}

function makeQuestionRepliedEvent(requestID: string): { event: OpencodeEvent } {
  return {
    event: {
      type: "question.replied",
      properties: { sessionID: "s-1", requestID, answers: [["yes"]] },
    } as OpencodeEvent,
  };
}

function makeQuestionRejectedEvent(requestID: string): { event: OpencodeEvent } {
  return {
    event: {
      type: "question.rejected",
      properties: { sessionID: "s-1", requestID },
    } as OpencodeEvent,
  };
}

describe("createQuestionHook", () => {
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

  it("ignores non-question events", async () => {
    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "s-1" } },
      } as OpencodeEvent,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).not.toHaveBeenCalled();
    expect(dedup.isDuplicate).not.toHaveBeenCalled();
  });

  it("sends notification on question.asked after delay", async () => {
    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook(makeQuestionAskedEvent("q-1", "Continue?", [
      { label: "yes", description: "Proceed" },
      { label: "no", description: "Stop" },
    ]));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const call = sendSpy.mock.calls[0]!;
    expect(call[1].title).toBe("❓ OpenCode Question");
    expect(call[1].body).toContain("Continue?");
  });

  it("extracts question text and option labels into payload", async () => {
    let capturedPayload: NotificationPayload | undefined;
    const dedup: DedupChecker = {
      isDuplicate: mock((payload: NotificationPayload) => {
        capturedPayload = payload;
        return false;
      }),
      clear: mock(() => {}),
    };

    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook(makeQuestionAskedEvent("q-2", "Deploy to prod?", [
      { label: "yes", description: "Ship it" },
      { label: "no", description: "Abort" },
      { label: "cancel", description: "Cancel deploy" },
    ]));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload!.type).toBe("question");
    expect(capturedPayload!.title).toBe("❓ OpenCode Question");
    expect(capturedPayload!.context.question).toBe("Deploy to prod?");
    expect(capturedPayload!.context.options).toEqual(["yes", "no", "cancel"]);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0]!;
    expect(call[1].body).toContain("Deploy to prod?");
    expect(call[1].notificationType).toBe("warning");
  });

  it("question.replied cancels pending timer", async () => {
    const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 60_000);

    await hook(makeQuestionAskedEvent("q-3", "Continue?"));
    await hook(makeQuestionRepliedEvent("q-3"));

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("question.rejected cancels pending timer", async () => {
    const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 60_000);

    await hook(makeQuestionAskedEvent("q-4", "Pick a color?"));
    await hook(makeQuestionRejectedEvent("q-4"));

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("question with no options sends notification without options", async () => {
    let capturedPayload: NotificationPayload | undefined;
    const dedup: DedupChecker = {
      isDuplicate: mock((payload: NotificationPayload) => {
        capturedPayload = payload;
        return false;
      }),
      clear: mock(() => {}),
    };

    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook(makeQuestionAskedEvent("q-5", "What should I do?"));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload!.context.options).toBeUndefined();
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("dedup blocks duplicate question", async () => {
    const dedup = makeDedup(true);
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook(makeQuestionAskedEvent("q-6", "Same question again"));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("handles sendNotification errors gracefully", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    sendSpy.mockRejectedValueOnce(new Error("network failure"));

    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook(makeQuestionAskedEvent("q-7", "Will this error?"));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("ignores question.asked with empty questions array", async () => {
    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await hook({
      event: {
        type: "question.asked",
        properties: { id: "q-8", sessionID: "s-1", questions: [] },
      } as OpencodeEvent,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("includes sessionTitle in question notification", async () => {
    let capturedPayload: NotificationPayload | undefined;
    const dedup: DedupChecker = {
      isDuplicate: mock((payload: NotificationPayload) => {
        capturedPayload = payload;
        return false;
      }),
      clear: mock(() => {}),
    };

    const hook = createQuestionHook(makeDefaultInput("Deploy pipeline"), makeConfig(), dedup, 0);

    await hook(makeQuestionAskedEvent("q-title-1", "Which env?", [
      { label: "staging", description: "Staging env" },
    ]));

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(capturedPayload).toBeDefined();
    expect(capturedPayload!.context.sessionTitle).toBe("Deploy pipeline");

    const call = sendSpy.mock.calls[0]!;
    expect(call[1].body).toContain("TITLE: Deploy pipeline");
  });

  it("reply for unknown requestID does not throw", async () => {
    const dedup = makeDedup();
    const hook = createQuestionHook(makeDefaultInput(), makeConfig(), dedup, 0);

    await expect(hook(makeQuestionRepliedEvent("unknown-id"))).resolves.toBeUndefined();
  });
});
