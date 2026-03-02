import type { Hooks } from "@opencode-ai/plugin";
import type { Permission } from "@opencode-ai/sdk";
import type { DedupChecker } from "../dedup.js";
import { formatNotification, DEFAULT_TRUNCATE_LENGTH } from "../formatter.js";
import { sendNotification } from "../notifier.js";
import type { PluginConfig } from "../types.js";

export interface PermissionHooks {
  /** Primary: permission.ask hook */
  permissionAsk: NonNullable<Hooks["permission.ask"]>;
  /** Fallback: event hook watching permission.updated */
  eventFallback: NonNullable<Hooks["event"]>;
}

export function createPermissionHooks(
  config: PluginConfig,
  dedup: DedupChecker
): PermissionHooks {
  // Track which permissions we've already notified about (to avoid double-notify)
  const notifiedPermissions = new Set<string>();

  async function notifyPermission(permission: Permission): Promise<void> {
    const permId = (permission as { id?: string }).id ?? "unknown";
    if (notifiedPermissions.has(permId)) return;
    notifiedPermissions.add(permId);

    const toolName = (permission as unknown as { toolName?: string }).toolName ?? "Unknown Tool";
    const action = (permission as unknown as { action?: string }).action ?? "Unknown Action";

    const payload = {
      type: "permission" as const,
      title: "🔐 OpenCode Permission Required",
      context: {
        userRequest: undefined,
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName,
        action,
      },
    };

    if (dedup.isDuplicate(payload)) return;

    try {
      const formatted = formatNotification(payload, DEFAULT_TRUNCATE_LENGTH);
      await sendNotification(config, formatted);
    } catch (err: unknown) {
      console.warn("[opencode-apprise-notify] permission hook error:", err);
    }
  }

  const permissionAsk: NonNullable<Hooks["permission.ask"]> = async (input, _output) => {
    await notifyPermission(input);
  };

  const eventFallback: NonNullable<Hooks["event"]> = async ({ event }) => {
    if (event.type !== "permission.updated") return;
    const permission = (event as { properties: Permission }).properties;
    await notifyPermission(permission);
  };

  return { permissionAsk, eventFallback };
}
