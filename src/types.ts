/**
 * Plugin configuration loaded from environment variables
 */
export interface PluginConfig {
  /** Apprise URLs from APPRISE_URLS (comma/space separated) */
  appriseUrls: string[];

  /** Path to Apprise config file from APPRISE_CONFIG */
  appriseConfigPath: string | undefined;

  /** Idle delay in milliseconds from OPENCODE_NOTIFY_IDLE_DELAY (default: 3000) */
  idleDelayMs: number;

  /** Truncate notification body to this length from OPENCODE_NOTIFY_TRUNCATE (default: 1500) */
  truncateLength: number;

  /** Enable deduplication from OPENCODE_NOTIFY_DEDUP (default: true) */
  deduplication: boolean;

  /** Optional tag for notifications from OPENCODE_NOTIFY_TAG */
  tag: string | undefined;
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
