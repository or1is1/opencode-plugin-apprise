import type { Hooks } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import { formatNotification, DEFAULT_TRUNCATE_LENGTH } from "../formatter.js";
import { sendNotification } from "../notifier.js";
import type { PluginConfig } from "../types.js";

export interface QuestionHooks {
  before: NonNullable<Hooks["tool.execute.before"]>;
  after: NonNullable<Hooks["tool.execute.after"]>;
}

export function createQuestionHooks(
  config: PluginConfig,
  dedup: DedupChecker,
): QuestionHooks {
  const timers = new Map<string, NodeJS.Timeout>();

  const before: NonNullable<Hooks["tool.execute.before"]> = async ({
    tool,
    sessionID,
    callID,
  }) => {
    // Case-insensitive check for "question" tool
    if (tool.toLowerCase() !== "question") return;

    // Schedule notification after 30 seconds (allow quick user response)
    const timer = setTimeout(async () => {
      try {
        const messages = await fetchMessages(sessionID);

        let userRequest: string | undefined = undefined;
        let question: string | undefined = undefined;
        let options: string[] | undefined = undefined;

        // Find the question tool call
        for (const msg of messages) {
          const content = msg.content;
          if (typeof content === "object" && Array.isArray(content)) {
            for (const part of content) {
              if (part.type === "tool_use") {
                if (part.name === "question" && part.input) {
                  question = part.input.question;
                  options = part.input.options;
                } else if (part.type === "text" && part.text) {
                  userRequest = part.text;
                }
              }
            }
          }
        }

        if (!question || !options) return;

        const payload = {
          type: "question" as const,
          title: "❓ OpenCode Question",
          context: {
            userRequest,
            agentResponse: undefined,
            question,
            options,
            todoStatus: undefined,
            taskName: undefined,
            toolName: "Question",
            action: undefined,
          },
        };

        if (dedup.isDuplicate(payload)) return;

        try {
          const formatted = formatNotification(payload, DEFAULT_TRUNCATE_LENGTH);
          await sendNotification(config, formatted);
        } catch (err: unknown) {
          console.warn("[opencode-apprise-notify] question hook error:", err);
        }
      } catch (err: unknown) {
        console.warn("[opencode-apprise-notify] failed to fetch messages for question:", err);
      }
    }, 30_000);

    timers.set(callID, timer);
  };

  const after: NonNullable<Hooks["tool.execute.after"]> = async ({
    tool,
    callID,
  }) => {
    if (tool.toLowerCase() !== "question") return;

    const timer = timers.get(callID);
    if (timer) {
      clearTimeout(timer);
      timers.delete(callID);
    }
  };

  return { before, after };
}

async function fetchMessages(
  sessionID: string,
): Promise<Array<{ role: string; content: unknown }>> {
  // This is a placeholder — in real implementation, this would fetch from OpenCode client
  return [];
}
