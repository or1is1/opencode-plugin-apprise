import type {
  AppriseNotificationType,
  FormattedNotification,
  NotificationPayload,
} from "./types.js";

const TYPE_MAP: Record<string, AppriseNotificationType> = {
  idle: "info",
  question: "warning",
  background: "success",
  permission: "warning",
};

export const DEFAULT_TRUNCATE_LENGTH = 1500;

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const lines = text.split("\n");
  if (lines.length <= 10) {
    // Not enough lines for front/back split, fall back to char truncation
    const keepLength = maxLength - 20;
    return text.slice(0, keepLength) + "\n...(truncated)";
  }

  const head = lines.slice(0, 5).join("\n");
  const tail = lines.slice(-5).join("\n");
  const result = head + "\n...(truncated)\n" + tail;

  // Safety net: if still too long, fall back to char truncation
  if (result.length > maxLength) {
    return text.slice(0, maxLength - 20) + "\n...(truncated)";
  }

  return result;
}

export function formatTodoStatus(todos: Array<{ status: string; content: string }>): string {
  const done = todos.filter((todo) => todo.status === "completed").length;
  const inProgress = todos.filter((todo) => todo.status === "in_progress").length;
  const pending = todos.filter((todo) => todo.status === "pending").length;

  const parts: string[] = [];
  if (done > 0) parts.push(`✅ ${done} done`);
  if (inProgress > 0) parts.push(`▶️ ${inProgress} in_progress`);
  if (pending > 0) parts.push(`⚪ ${pending} pending`);

  return parts.length > 0 ? parts.join(" | ") : "No todos";
}

export function formatNotification(
  payload: NotificationPayload,
  truncateLength: number = DEFAULT_TRUNCATE_LENGTH,
): FormattedNotification {
  const { type, title, context } = payload;
  const notificationType = TYPE_MAP[type] ?? "info";

  let body: string;

  switch (type) {
    case "idle": {
      const parts: string[] = [];
      if (context.userRequest) parts.push(`📝 Request: ${context.userRequest}`);
      if (context.agentResponse) parts.push(`🤖 Response: ${context.agentResponse}`);
      if (context.todoStatus) parts.push(`📋 Todo: ${context.todoStatus}`);
      body = parts.join("\n\n");
      break;
    }
    case "question": {
      const parts: string[] = [];
      if (context.userRequest) parts.push(`📝 Request: ${context.userRequest}`);
      if (context.question) parts.push(`❓ Question: ${context.question}`);
      if (context.options && context.options.length > 0) {
        parts.push(`Options:\n${context.options.map((option, index) => `  ${index + 1}. ${option}`).join("\n")}`);
      }
      body = parts.join("\n\n");
      break;
    }
    case "background": {
      const parts: string[] = [];
      if (context.taskName) parts.push(`Task: ${context.taskName}`);
      if (context.agentResponse) parts.push(`Result: ${context.agentResponse}`);
      body = parts.join("\n\n");
      break;
    }
    case "permission": {
      const parts: string[] = [];
      if (context.toolName) parts.push(`🔧 Tool: ${context.toolName}`);
      if (context.action) parts.push(`⚡ Action: ${context.action}`);
      body = parts.join("\n\n");
      break;
    }
    default:
      body = "";
  }

  body = truncateText(body, truncateLength);

  return { title, body, notificationType };
}
