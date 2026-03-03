import type {
  AppriseNotificationType,
  FormattedNotification,
  HookEventType,
  NotificationPayload,
} from "./types.js";

const SEPARATOR = "\n\n────────────────────\n\n";

const TYPE_MAP: Record<HookEventType, AppriseNotificationType> = {
  idle: "info",
  question: "warning",
  permission: "warning",
};

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
): FormattedNotification {
  const { type, title, context } = payload;
  const notificationType = TYPE_MAP[type] ?? "info";

  let body: string;

  switch (type) {
    case "idle": {
      const parts: string[] = [];
      if (context.sessionTitle) parts.push(`📌 TITLE: ${context.sessionTitle}`);
      if (context.userRequest) parts.push(`📝 REQUEST: ${context.userRequest}`);
      if (context.agentResponse) parts.push(`🤖 RESPONSE: ${context.agentResponse}`);
      if (context.todoStatus) parts.push(`📋 TODO: ${context.todoStatus}`);
      body = parts.join(SEPARATOR);
      break;
    }
    case "question": {
      const parts: string[] = [];
      if (context.sessionTitle) parts.push(`📌 TITLE: ${context.sessionTitle}`);
      if (context.question) parts.push(`❓ QUESTION: ${context.question}`);
      if (context.options && context.options.length > 0) {
        parts.push(`OPTIONS:\n${context.options.map((option, index) => `  ${index + 1}. ${option}`).join("\n")}`);
      }
      body = parts.join(SEPARATOR);
      break;
    }
    case "permission": {
      const parts: string[] = [];
      if (context.toolName) parts.push(`🔧 TOOL: ${context.toolName}`);
      if (context.action) parts.push(`⚡ ACTION: ${context.action}`);
      body = parts.join(SEPARATOR);
      break;
    }
    default:
      body = "";
  }

  return { title, body, notificationType };
}
