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
  delayMs: number = 30_000,
): QuestionHooks {
  const timers = new Map<string, NodeJS.Timeout>();

  const before: NonNullable<Hooks["tool.execute.before"]> = async (
    { tool, callID },
    input,
  ) => {
    // Case-insensitive check for "question" tool
    if (tool.toLowerCase() !== "question") return;

    const args = (input as { args?: { question?: unknown; options?: unknown } } | undefined)?.args;
    const question = typeof args?.question === "string" ? args.question : undefined;
    const options = Array.isArray(args?.options)
      ? args.options.filter((option): option is string => typeof option === "string")
      : undefined;

    // Schedule notification after 30 seconds (allow quick user response)
    const timer = setTimeout(async () => {
      if (!question) return;

      const payload = {
        type: "question" as const,
        title: "❓ OpenCode Question",
        context: {
          userRequest: undefined,
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
    }, delayMs);

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
