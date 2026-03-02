import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import { formatTodoStatus } from "../formatter.js";
import type { PluginConfig } from "../types.js";
import { createPayload, sendHookNotification } from "./shared.js";

interface SessionMessage {
  role?: string;
  content?: unknown;
}

function extractText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }

  const parts = Array.isArray(message)
    ? message.map((p: unknown) => typeof p === "string" ? p : ((p as Record<string, unknown>).text as string) || "")
    : [];

  return parts.join("\n").trim() || undefined;
}

export function createIdleHook(
  ctx: PluginInput,
  config: PluginConfig,
  dedup: DedupChecker,
): NonNullable<Hooks["event"]> {
  return async ({ event }) => {
    if (event.type !== "session.idle") return;

    const props = event.properties as { sessionID: string };
    if (!props.sessionID) return;

    let userRequest: string | undefined = undefined;
    let agentResponse: string | undefined = undefined;
    let todoStatus: string | undefined = undefined;

    try {
      const messagesResponse = await ctx.client.session.messages({
        path: { id: props.sessionID },
      });
      const messages = (messagesResponse.data ?? []) as unknown as SessionMessage[];

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg?.role === "user") {
          userRequest = extractText(msg.content);
          break;
        }
      }

      if (userRequest) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg?.role === "assistant") {
            agentResponse = extractText(msg.content);
            break;
          }
        }
      }

      try {
        const todosResponse = await ctx.client.session.todo({
          path: { id: props.sessionID },
        });
        if (todosResponse.data) {
          todoStatus = formatTodoStatus(todosResponse.data);
        }
      } catch {
        // Session might not have todos — ignore
      }
    } catch (err: unknown) {
      console.warn("[opencode-plugin-apprise] failed to fetch session data:", err);
    }

    const payload = createPayload("idle", "📢 OpenCode Attention Required", {
      userRequest,
      agentResponse,
      todoStatus,
    });

    await sendHookNotification("idle", config, dedup, payload);
  };
}
