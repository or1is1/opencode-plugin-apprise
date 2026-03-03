export interface PluginConfig {
  tag?: string;
}

export type HookEventType = "idle" | "question" | "permission";

export type AppriseNotificationType = "info" | "warning" | "success" | "failure";

export interface NotificationContext {
  userRequest: string | undefined;
  agentResponse: string | undefined;
  question: string | undefined;
  options: string[] | undefined;
  todoStatus: string | undefined;
  toolName: string | undefined;
  action: string | undefined;
}

export interface NotificationPayload {
  type: HookEventType;
  title: string;
  context: NotificationContext;
}

export interface FormattedNotification {
  title: string;
  body: string;
  notificationType: AppriseNotificationType;
}
