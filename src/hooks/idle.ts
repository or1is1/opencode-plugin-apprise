import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import { formatNotification, formatTodoStatus, DEFAULT_TRUNCATE_LENGTH } from "../formatter.js";
import { sendNotification } from "../notifier.js";
import type { PluginConfig } from "../types.js";

export const DEFAULT_IDLE_DELAY_MS = 3000;

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
    // Listen for session.idle events
    if (event.type !== "session.idle") return;

    const props = event.properties as { sessionID: string };
    if (!props.sessionID) return;

    // Extract rich context from session
    let userRequest: string | undefined = undefined;
    let agentResponse: string | undefined = undefined;
    let todoStatus: string | undefined = undefined;

    try {
      const messagesResponse = await ctx.client.session.messages({
        path: { id: props.sessionID },
      });
      // SDK wraps response in { data, error } — extract the array
      const messages = (messagesResponse.data ?? []) as unknown as SessionMessage[];

      // Get last user message
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg?.role === "user") {
          userRequest = extractText(msg.content);
          break;
        }
      }

      // Get last agent message before user's last message
      if (userRequest) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg?.role === "assistant") {
            agentResponse = extractText(msg.content);
            break;
          }
        }
      }

      // Get todo status
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
      console.warn("[opencode-apprise-notify] failed to fetch session data:", err);
    }

    // Build notification payload
    const payload = {
      type: "idle" as const,
      title: "📢 OpenCode Attention Required",
      context: {
        userRequest,
        agentResponse,
        question: undefined,
        options: undefined,
        todoStatus,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };

    if (dedup.isDuplicate(payload)) return;

    try {
      const formatted = formatNotification(payload, DEFAULT_TRUNCATE_LENGTH);
      await sendNotification(config, formatted);
    } catch (err: unknown) {
      console.warn("[opencode-apprise-notify] idle hook error:", err);
    }
  };
}
