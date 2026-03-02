import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { Event as OpencodeEvent } from "@opencode-ai/sdk";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createBackgroundHook } from "../../src/hooks/background.js";

function makeConfig(): PluginConfig {
  return {
    idleDelayMs: 3000,
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

describe("createBackgroundHook", () => {
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

  it("sends notification on session.status with status.type idle", async () => {
    const dedup = makeDedup(false);
    const hook = createBackgroundHook(makeConfig(), dedup);

    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-1", status: { type: "idle" } },
      } as OpencodeEvent,
    });

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const call = sendSpy.mock.calls[0]!;
    expect(call[1].title).toBe("✅ Background Task Complete");
    expect(dedup.isDuplicate).toHaveBeenCalled();
    const payload = (dedup.isDuplicate as ReturnType<typeof mock>).mock.calls[0]![0] as NotificationPayload;
    expect(payload.type).toBe("background");
    expect(payload.context.taskName).toBe("Session s-1");
  });

  it("ignores session.status with status.type busy", async () => {
    const dedup = makeDedup(false);
    const hook = createBackgroundHook(makeConfig(), dedup);

    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-2", status: { type: "busy" } },
      } as OpencodeEvent,
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(dedup.isDuplicate).not.toHaveBeenCalled();
  });

  it("ignores non-session.status events", async () => {
    const dedup = makeDedup(false);
    const hook = createBackgroundHook(makeConfig(), dedup);

    await hook({
      event: {
        type: "message.updated",
        properties: { info: { sessionID: "s-3" } },
      } as OpencodeEvent,
    });

    expect(sendSpy).not.toHaveBeenCalled();
    expect(dedup.isDuplicate).not.toHaveBeenCalled();
  });

  it("does not send notification when dedup blocks", async () => {
    const dedup = makeDedup(true);
    const hook = createBackgroundHook(makeConfig(), dedup);

    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-4", status: { type: "idle" } },
      } as OpencodeEvent,
    });

    expect(dedup.isDuplicate).toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("handles sendNotification errors gracefully", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    sendSpy.mockRejectedValueOnce(new Error("send failed"));
    const dedup = makeDedup(false);
    const hook = createBackgroundHook(makeConfig(), dedup);

    await hook({
      event: {
        type: "session.status",
        properties: { sessionID: "s-5", status: { type: "idle" } },
      } as OpencodeEvent,
    });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
