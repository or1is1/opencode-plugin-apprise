import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import type { PluginConfig } from "../types.js";
import { createPayload, sendHookNotification } from "./shared.js";

interface QuestionAskedProperties {
  id: string;
  sessionID: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
  }>;
}

interface QuestionReplyProperties {
  requestID: string;
}

export function createQuestionHook(
  ctx: PluginInput,
  config: PluginConfig,
  dedup: DedupChecker,
  delayMs: number = 30_000,
): NonNullable<Hooks["event"]> {
  const timers = new Map<string, NodeJS.Timeout>();

  return async ({ event }) => {
    // SDK v1 Event union is incomplete — v2 event types exist at runtime
    const eventType: string = event.type;

    if (eventType === "question.replied" || eventType === "question.rejected") {
      const props = (event as unknown as { properties: QuestionReplyProperties }).properties;
      const timer = timers.get(props.requestID);
      if (timer) {
        clearTimeout(timer);
        timers.delete(props.requestID);
      }
      return;
    }

    if (eventType !== "question.asked") return;

    const props = (event as unknown as { properties: QuestionAskedProperties }).properties;
    const firstQuestion = props.questions[0];
    if (!firstQuestion) return;

    const question = firstQuestion.question;
    const options = firstQuestion.options.map((opt) => opt.label);
    const requestId = props.id;

    const sessionID = props.sessionID;

    const timer = setTimeout(async () => {
      timers.delete(requestId);

      let sessionTitle: string | undefined;
      try {
        const sessionResponse = await ctx.client.session.get({ path: { id: sessionID } });
        const sessionInfo = sessionResponse.data as unknown as { title?: string };
        sessionTitle = sessionInfo.title || undefined;
      } catch {
        // Session title is optional — continue without it
      }

      const payload = createPayload("question", "❓ OpenCode Question", {
        sessionTitle,
        question,
        options: options.length > 0 ? options : undefined,
      });

      await sendHookNotification("question", config, dedup, payload);
    }, delayMs);

    timers.set(requestId, timer);
  };
}
