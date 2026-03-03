import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { Event as OpencodeEvent, Permission } from "@opencode-ai/sdk";
import type { DedupChecker } from "../../src/dedup.js";
import * as notifier from "../../src/notifier.js";
import type { NotificationPayload, PluginConfig } from "../../src/types.js";
import { createPermissionHooks } from "../../src/hooks/permission.js";

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
    it("sends notification using v1 Permission fields (title, pattern)", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

      const permission = makePermission({
        id: "perm-ask-1",
        title: "Execute bash command",
        pattern: ["rm -rf /tmp/*"],
      } as Record<string, unknown>);

      await hooks.permissionAsk(permission, { status: "ask" });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const call = sendSpy.mock.calls[0]!;
      expect(call[1].title).toBe("🔐 OpenCode Permission Required");
      expect(dedup.isDuplicate).toHaveBeenCalled();
      const payload = (dedup.isDuplicate as ReturnType<typeof mock>).mock.calls[0]![0] as NotificationPayload;
      expect(payload.type).toBe("permission");
      expect(payload.context.toolName).toBe("Execute bash command");
      expect(payload.context.action).toBe("rm -rf /tmp/*");
    });

    it("handles string pattern (non-array)", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

      const permission = makePermission({
        id: "perm-str-1",
        title: "Write file",
        pattern: "/etc/hosts",
      } as Record<string, unknown>);

      await hooks.permissionAsk(permission, { status: "ask" });

      const payload = (dedup.isDuplicate as ReturnType<typeof mock>).mock.calls[0]![0] as NotificationPayload;
      expect(payload.context.action).toBe("/etc/hosts");
    });

    it("falls back to 'Unknown' when title/pattern are missing", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

      const permission = makePermission({ id: "perm-fallback-1" });

      await hooks.permissionAsk(permission, { status: "ask" });

      const payload = (dedup.isDuplicate as ReturnType<typeof mock>).mock.calls[0]![0] as NotificationPayload;
      expect(payload.context.toolName).toBe("Run command");
      expect(payload.context.action).toBe("Unknown");
    });

    it("does not send notification when dedup blocks", async () => {
      const dedup = makeDedup(true);
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

      const permission = makePermission({ id: "perm-dedup-1" });
      await hooks.permissionAsk(permission, { status: "ask" });

      expect(dedup.isDuplicate).toHaveBeenCalled();
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe("eventFallback", () => {
    it("sends notification on permission.asked event with v2 fields", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

      await hooks.eventFallback({
        event: {
          type: "permission.asked",
          properties: {
            id: "perm-event-1",
            sessionID: "s-1",
            permission: "bash",
            patterns: ["rm -rf /tmp/*"],
            metadata: {},
            always: [],
          },
        } as OpencodeEvent,
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
      const call = sendSpy.mock.calls[0]!;
      expect(call[1].title).toBe("🔐 OpenCode Permission Required");
      const payload = (dedup.isDuplicate as ReturnType<typeof mock>).mock.calls[0]![0] as NotificationPayload;
      expect(payload.context.toolName).toBe("bash");
      expect(payload.context.action).toBe("rm -rf /tmp/*");
    });

    it("ignores non-permission.asked events", async () => {
      const dedup = makeDedup(false);
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

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
      const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

      const permission = makePermission({
        id: "perm-shared-1",
        title: "Run tests",
        pattern: ["bun test"],
      } as Record<string, unknown>);

      await hooks.permissionAsk(permission, { status: "ask" });
      expect(sendSpy).toHaveBeenCalledTimes(1);

      await hooks.eventFallback({
        event: {
          type: "permission.asked",
          properties: {
            id: "perm-shared-1",
            sessionID: "s-1",
            permission: "bash",
            patterns: ["bun test"],
            metadata: {},
            always: [],
          },
        } as OpencodeEvent,
      });

      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  it("includes sessionTitle in permission notification", async () => {
    let capturedPayload: NotificationPayload | undefined;
    const dedup: DedupChecker = {
      isDuplicate: mock((payload: NotificationPayload) => {
        capturedPayload = payload;
        return false;
      }),
      clear: mock(() => {}),
    };
    const hooks = createPermissionHooks(makeDefaultInput("Build Pipeline"), makeConfig(), dedup);

    const permission = makePermission({
      id: "perm-title-1",
      title: "Bash",
      pattern: ["npm run build"],
      sessionID: "s-1",
    } as Record<string, unknown>);

    await hooks.permissionAsk(permission, { status: "ask" });

    expect(capturedPayload).toBeDefined();
    expect(capturedPayload!.context.sessionTitle).toBe("Build Pipeline");

    const call = sendSpy.mock.calls[0]!;
    expect(call[1].body).toContain("TITLE: Build Pipeline");
  });

  it("handles sendNotification errors gracefully", async () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    sendSpy.mockRejectedValueOnce(new Error("send failed"));
    const dedup = makeDedup(false);
    const hooks = createPermissionHooks(makeDefaultInput(), makeConfig(), dedup);

    const permission = makePermission({ id: "perm-err-1" });
    await hooks.permissionAsk(permission, { status: "ask" });

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
