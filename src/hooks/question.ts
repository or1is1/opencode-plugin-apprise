import type { Hooks, PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../dedup.js";
import type { PluginConfig, QuestionAskedProperties, QuestionReplyProperties } from "../types.js";
import { createPayload, fetchSessionTitle, sendHookNotification } from "./shared.js";

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

      const sessionTitle = await fetchSessionTitle(ctx, sessionID);

      const payload = createPayload("question", "OpenCode Question", {
        sessionTitle,
        question,
        options: options.length > 0 ? options : undefined,
      });

      await sendHookNotification("question", config, dedup, payload);
    }, delayMs);

    timers.set(requestId, timer);
  };
}
