/**
 * Minimal plugin configuration.
 * All values handled by Apprise defaults.
 */
export interface PluginConfig {
  /** Optional tag for filtering notifications */
  tag?: string;
}

/**
 * Type of notification event
 */
export type HookEventType = "idle" | "question" | "background" | "permission";

/**
 * Apprise notification type mapping
 */
export type AppriseNotificationType = "info" | "warning" | "success" | "failure";

/**
 * Rich context for notifications
 */
export interface NotificationContext {
  /** Last user message */
  userRequest: string | undefined;

  /** Last agent response */
  agentResponse: string | undefined;

  /** Question text (for question events) */
  question: string | undefined;

  /** Question options */
  options: string[] | undefined;

  /** Formatted todo summary */
  todoStatus: string | undefined;

  /** Background task name */
  taskName: string | undefined;

  /** Tool name (for permission events) */
  toolName: string | undefined;

  /** Action description (for permission events) */
  action: string | undefined;
}

/**
 * Full notification payload
 */
export interface NotificationPayload {
  /** Type of hook event */
  type: HookEventType;

  /** Notification title */
  title: string;

  /** Rich context for the notification */
  context: NotificationContext;
}

/**
 * Formatted notification ready for Apprise
 */
export interface FormattedNotification {
  /** Notification title */
  title: string;

  /** Notification body content */
  body: string;

  /** Apprise notification type */
  notificationType: AppriseNotificationType;
}
