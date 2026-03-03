export interface PluginConfig {
  tag?: string;
}

export type HookEventType = "idle" | "question" | "permission";

export type AppriseNotificationType = "info" | "warning" | "success" | "failure";

export interface NotificationContext {
  sessionTitle: string | undefined;
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

// SDK response types — not exported by @opencode-ai/plugin
export interface SessionInfo {
  parentID?: string;
  title?: string;
}

export interface MessagePart {
  type: string;
  text?: string;
  synthetic?: boolean;
}

export interface SessionMessage {
  info: { role: string };
  parts: MessagePart[];
}

// SDK event property types — v2 runtime types not in v1 SDK type definitions
export interface QuestionAskedProperties {
  id: string;
  sessionID: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
  }>;
}

export interface QuestionReplyProperties {
  requestID: string;
}

export interface PermissionAskedProperties {
  id: string;
  sessionID?: string;
  permission: string;
  patterns: string[];
}
