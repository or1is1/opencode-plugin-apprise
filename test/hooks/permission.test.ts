import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { Event as OpencodeEvent, Permission } from "@opencode-ai/sdk";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createPermissionHooks } from "../../src/hooks/permission.js";

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

function makePermission(overrides: Partial<Permission> & Record<string, unknown> = {}): Permission {
  return {
    id: "perm-1",
    type: "tool",
    sessionID: "s-1",
    messageID: "m-1",
    title: "Run command",
    metadata: {},
    time: { created: Date.now() },
    ...overrides,
  } as Permission;
}

describe("createPermissionHooks", () => {
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

  describe("permissionAsk", () => {
    it("sends notification on permission.ask", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeConfig(), dedup);

      const permission = makePermission({
        id: "perm-ask-1",
        toolName: "bash",
        action: "execute rm -rf",
      } as Record<string, unknown>);

      await hooks.permissionAsk(permission, { status: "ask" });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const call = sendSpy.mock.calls[0]!;
      expect(call[1].title).toBe("🔐 OpenCode Permission Required");
      expect(dedup.isDuplicate).toHaveBeenCalled();
      const payload = (dedup.isDuplicate as ReturnType<typeof mock>).mock.calls[0]![0] as NotificationPayload;
      expect(payload.type).toBe("permission");
      expect(payload.context.toolName).toBe("bash");
      expect(payload.context.action).toBe("execute rm -rf");
    });

    it("does not send notification when dedup blocks", async () => {
      const dedup = makeDedup(true);
      const hooks = createPermissionHooks(makeConfig(), dedup);

      const permission = makePermission({ id: "perm-dedup-1" });
      await hooks.permissionAsk(permission, { status: "ask" });

      expect(dedup.isDuplicate).toHaveBeenCalled();
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe("eventFallback", () => {
    it("sends notification on permission.updated event", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeConfig(), dedup);

      const permission = makePermission({
        id: "perm-event-1",
        toolName: "file_write",
        action: "write to /etc/hosts",
      } as Record<string, unknown>);

      await hooks.eventFallback({
        event: {
          type: "permission.updated",
          properties: permission,
        } as OpencodeEvent,
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const call = sendSpy.mock.calls[0]!;
      expect(call[1].title).toBe("🔐 OpenCode Permission Required");
    });

    it("ignores non-permission.updated events", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeConfig(), dedup);

      await hooks.eventFallback({
        event: {
          type: "message.updated",
          properties: { info: { sessionID: "s-1" } },
        } as OpencodeEvent,
      });

      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe("dedup via notifiedPermissions Set", () => {
    it("only notifies once for the same permission ID across both paths", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeConfig(), dedup);

      const permission = makePermission({
        id: "perm-shared-1",
        toolName: "bash",
        action: "run tests",
      } as Record<string, unknown>);

      // First: permission.ask fires
      await hooks.permissionAsk(permission, { status: "ask" });
      expect(sendSpy).toHaveBeenCalledTimes(1);

      // Second: permission.updated also fires for same permission
      await hooks.eventFallback({
        event: {
          type: "permission.updated",
          properties: permission,
        } as OpencodeEvent,
      });

      // Should still be 1 — the Set prevented double-notify
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("handles sendNotification errors gracefully", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    sendSpy.mockRejectedValueOnce(new Error("send failed"));
    const dedup = makeDedup(false);
    const hooks = createPermissionHooks(makeConfig(), dedup);

    const permission = makePermission({ id: "perm-err-1" });
    await hooks.permissionAsk(permission, { status: "ask" });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
