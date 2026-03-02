import type { DedupChecker } from "../dedup.js";
import { formatNotification, DEFAULT_TRUNCATE_LENGTH } from "../formatter.js";
import { sendNotification } from "../notifier.js";
import type { HookEventType, NotificationContext, NotificationPayload, PluginConfig } from "../types.js";

const EMPTY_CONTEXT: NotificationContext = {
  userRequest: undefined,
  agentResponse: undefined,
  question: undefined,
  options: undefined,
  todoStatus: undefined,
  taskName: undefined,
  toolName: undefined,
  action: undefined,
};

export function createPayload(
  type: HookEventType,
  title: string,
  context: Partial<NotificationContext> = {},
): NotificationPayload {
  return {
    type,
    title,
    context: { ...EMPTY_CONTEXT, ...context },
  };
}

export async function sendHookNotification(
  hookName: string,
  config: PluginConfig,
  dedup: DedupChecker,
  payload: NotificationPayload,
): Promise<void> {
  if (dedup.isDuplicate(payload)) return;

  try {
    const formatted = formatNotification(payload, DEFAULT_TRUNCATE_LENGTH);
    await sendNotification(config, formatted);
  } catch (err: unknown) {
    console.warn(`[opencode-plugin-apprise] ${hookName} hook error:`, err);
  }
}
