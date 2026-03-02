import type { Hooks } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import { formatNotification, DEFAULT_TRUNCATE_LENGTH } from "../formatter.js";
import { sendNotification } from "../notifier.js";
import type { PluginConfig } from "../types.js";

export function createBackgroundHook(
  config: PluginConfig,
  dedup: DedupChecker,
): NonNullable<Hooks["event"]> {
  return async ({ event }) => {
    // Listen for session.status events where status.type === "idle"
    // This fires when a background task completes and the session goes idle
    if (event.type !== "session.status") return;

    const props = event.properties as { sessionID: string; status: { type: string } };
    if (props.status.type !== "idle") return;

    const payload = {
      type: "background" as const,
      title: "✅ Background Task Complete",
      context: {
        userRequest: undefined,
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: `Session ${props.sessionID}`,
        toolName: undefined,
        action: undefined,
      },
    };

    if (dedup.isDuplicate(payload)) return;

    try {
      const formatted = formatNotification(payload, DEFAULT_TRUNCATE_LENGTH);
      await sendNotification(config, formatted);
    } catch (err: unknown) {
      console.warn("[opencode-apprise-notify] background hook error:", err);
    }
  };
}
