import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createQuestionHooks } from "../../src/hooks/question.js";

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

describe("createQuestionHooks", () => {
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

  it("non-question tool → before hook does nothing", async () => {
    const dedup = makeDedup();
    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "bash", sessionID: "s-1", callID: "c-1" },
      { args: { command: "ls" } }
    );

    // No timer set, no notification
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).not.toHaveBeenCalled();
    expect(dedup.isDuplicate).not.toHaveBeenCalled();
  });

  it("\"Question\" tool (exact case) → timer is set and fires", async () => {
    const dedup = makeDedup();
    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "Question", sessionID: "s-2", callID: "c-2" },
      { args: { question: "Continue?", options: ["yes", "no"] } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).toHaveBeenCalledTimes(1);

    const call = sendSpy.mock.calls[0]!;
    expect(call[1].title).toBe("❓ OpenCode Question");
    expect(call[1].body).toContain("Continue?");
  });

  it("\"question\" (lowercase) → timer is set (case-insensitive)", async () => {
    const dedup = makeDedup();
    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "question", sessionID: "s-3", callID: "c-3" },
      { args: { question: "Pick a color" } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("\"QUESTION\" (uppercase) → timer is set (case-insensitive)", async () => {
    const dedup = makeDedup();
    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "QUESTION", sessionID: "s-4", callID: "c-4" },
      { args: { question: "Are you sure?" } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("sends notification with type 'question' and question text after delay", async () => {
    let capturedPayload: NotificationPayload | undefined;
    const dedup: DedupChecker = {
      isDuplicate: mock((payload: NotificationPayload) => {
        capturedPayload = payload;
        return false;
      }),
      clear: mock(() => {}),
    };

    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "question", sessionID: "s-5", callID: "c-5" },
      { args: { question: "Deploy to prod?", options: ["yes", "no", "cancel"] } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload!.type).toBe("question");
    expect(capturedPayload!.title).toBe("❓ OpenCode Question");
    expect(capturedPayload!.context.question).toBe("Deploy to prod?");
    expect(capturedPayload!.context.options).toEqual(["yes", "no", "cancel"]);
    expect(capturedPayload!.context.toolName).toBe("Question");

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0]!;
    expect(call[1].body).toContain("Deploy to prod?");
    expect(call[1].notificationType).toBe("warning");
  });

  it("after hook cancels pending timer \u2192 sendNotification NOT called", async () => {
    const clearTimeoutSpy = spyOn(globalThis, "clearTimeout");
    const dedup = makeDedup();
    // Use a very long delay that will never fire during the test
    const { before, after } = createQuestionHooks(makeConfig(), dedup, 60_000);

    await before(
      { tool: "question", sessionID: "s-6", callID: "c-6" },
      { args: { question: "Continue?" } }
    );

    // Cancel immediately via after hook
    await after(
      { tool: "question", sessionID: "s-6", callID: "c-6", args: { question: "Continue?" } },
      { title: "Question", output: "yes", metadata: {} }
    );

    // Verify clearTimeout was called (timer was cancelled)
    expect(clearTimeoutSpy).toHaveBeenCalled();
    // sendNotification should NOT have been called (timer was cancelled before firing)
    expect(sendSpy).not.toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it("after hook ignores non-question tools", async () => {
    const dedup = makeDedup();
    const { before, after } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "question", sessionID: "s-7", callID: "c-7" },
      { args: { question: "Test?" } }
    );

    // After hook for different tool should NOT cancel the question timer
    await after(
      { tool: "bash", sessionID: "s-7", callID: "c-other", args: {} },
      { title: "Bash", output: "done", metadata: {} }
    );

    // The question timer should still fire (delayMs=0)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).toHaveBeenCalled();
  });

  it("dedup blocks duplicate question → sendNotification NOT called", async () => {
    const dedup = makeDedup(true); // always returns true = duplicate
    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "question", sessionID: "s-8", callID: "c-8" },
      { args: { question: "Same question again" } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("handles sendNotification errors gracefully", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    sendSpy.mockRejectedValueOnce(new Error("network failure"));

    const dedup = makeDedup();
    const { before } = createQuestionHooks(makeConfig(), dedup, 0);

    await before(
      { tool: "question", sessionID: "s-9", callID: "c-9" },
      { args: { question: "Will this error?" } }
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
