import type { PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import { formatNotification } from "../formatter.js";
import { sendNotification } from "../notifier.js";
import type { HookEventType, MessagePart, NotificationContext, NotificationPayload, PluginConfig, SessionInfo } from "../types.js";

const EMPTY_CONTEXT: NotificationContext = {
  sessionTitle: undefined,
  userRequest: undefined,
  agentResponse: undefined,
  question: undefined,
  options: undefined,
  todoStatus: undefined,
  toolName: undefined,
  action: undefined,
};

export async function fetchSessionTitle(
  ctx: PluginInput,
  sessionID: string,
): Promise<string | undefined> {
  try {
    const response = await ctx.client.session.get({ path: { id: sessionID } });
    const info = response.data as unknown as SessionInfo;
    return info.title || undefined;
  } catch {
    return undefined;
  }
}

export function extractText(parts: MessagePart[]): string | undefined {
  const textParts = parts.filter((p) => p.type === "text" && p.text);
  const nonSynthetic = textParts.filter((p) => !p.synthetic);
  const source = nonSynthetic.length > 0 ? nonSynthetic : textParts;
  const texts = source.map((p) => p.text as string);

  return texts.join("\n").trim() || undefined;
}

export function isFullySyntheticMessage(parts: MessagePart[]): boolean {
  const textParts = parts.filter((p) => p.type === "text");
  return textParts.length > 0 && textParts.every((p) => p.synthetic === true);
}

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
    const formatted = formatNotification(payload);
    await sendNotification(config, formatted);
  } catch (err: unknown) {
    console.warn(`[opencode-plugin-apprise] ${hookName} hook error:`, err);
  }
}
