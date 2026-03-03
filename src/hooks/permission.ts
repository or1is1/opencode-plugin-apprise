import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import type { PermissionAskedProperties, PluginConfig } from "../types.js";
import { createPayload, fetchSessionTitle, sendHookNotification } from "./shared.js";

export interface PermissionHooks {
  /** Primary: permission.ask hook */
  permissionAsk: NonNullable<Hooks["permission.ask"]>;
  /** Fallback: event hook watching permission.asked */
  eventFallback: NonNullable<Hooks["event"]>;
}

export function createPermissionHooks(
  ctx: PluginInput,
  config: PluginConfig,
  dedup: DedupChecker,
): PermissionHooks {
  const notifiedPermissions = new Set<string>();

  // v1 Permission: { id, type, title, pattern?, sessionID, messageID, ... }
  const permissionAsk: NonNullable<Hooks["permission.ask"]> = async (input, _output) => {
    const permId = (input as { id?: string }).id ?? "unknown";
    if (notifiedPermissions.has(permId)) return;
    notifiedPermissions.add(permId);

    const title = (input as unknown as { title?: string }).title ?? "Unknown";
    const pattern = (input as unknown as { pattern?: string | string[] }).pattern;
    const action = Array.isArray(pattern) ? pattern.join(", ") : (pattern ?? "Unknown");
    const sessionID = (input as unknown as { sessionID?: string }).sessionID;

    const sessionTitle = sessionID ? await fetchSessionTitle(ctx, sessionID) : undefined;

    const payload = createPayload("permission", "OpenCode Permission Required", {
      sessionTitle,
      toolName: title,
      action,
    });

    await sendHookNotification("permission", config, dedup, payload);
  };

  // v2 PermissionRequest: { id, sessionID, permission, patterns, metadata, ... }
  const eventFallback: NonNullable<Hooks["event"]> = async ({ event }) => {
    const eventType: string = event.type;
    if (eventType !== "permission.asked") return;

    const props = (event as unknown as { properties: PermissionAskedProperties }).properties;

    const permId = props.id ?? "unknown";
    if (notifiedPermissions.has(permId)) return;
    notifiedPermissions.add(permId);

    const sessionID = (props as unknown as { sessionID?: string }).sessionID;
    const sessionTitle = sessionID ? await fetchSessionTitle(ctx, sessionID) : undefined;

    const payload = createPayload("permission", "OpenCode Permission Required", {
      sessionTitle,
      toolName: props.permission ?? "Unknown",
      action: props.patterns?.join(", ") ?? "Unknown",
    });

    await sendHookNotification("permission", config, dedup, payload);
  };

  return { permissionAsk, eventFallback };
}
