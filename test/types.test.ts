import { describe, it, expect } from "bun:test";
import type {
  PluginConfig,
  HookEventType,
  AppriseNotificationType,
  NotificationContext,
  NotificationPayload,
  FormattedNotification,
} from "../src/types";

describe("Type Definitions", () => {
  describe("PluginConfig", () => {
    it("should accept a valid PluginConfig object", () => {
      const config: PluginConfig = {
        appriseUrls: ["apprise://service/token"],
        appriseConfigPath: "/path/to/config",
        idleDelayMs: 3000,
        truncateLength: 1500,
        deduplication: true,
        tag: "my-tag",
      };

      // Runtime shape verification
      expect(typeof config.appriseUrls).toBe("object");
      expect(Array.isArray(config.appriseUrls)).toBe(true);
      expect(typeof config.idleDelayMs).toBe("number");
      expect(typeof config.truncateLength).toBe("number");
      expect(typeof config.deduplication).toBe("boolean");
    });

    it("should accept PluginConfig with undefined optional fields", () => {
      const config: PluginConfig = {
        appriseUrls: [],
        appriseConfigPath: undefined,
        idleDelayMs: 5000,
        truncateLength: 2000,
        deduplication: false,
        tag: undefined,
      };

      expect(config.appriseConfigPath).toBeUndefined();
      expect(config.tag).toBeUndefined();
    });
  });

  describe("HookEventType", () => {
    it("should accept valid HookEventType values", () => {
      const types: HookEventType[] = ["idle", "question", "background", "permission"];

      types.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(["idle", "question", "background", "permission"]).toContain(type);
      });
    });
  });

  describe("AppriseNotificationType", () => {
    it("should accept valid AppriseNotificationType values", () => {
      const types: AppriseNotificationType[] = ["info", "warning", "success", "failure"];

      types.forEach((type) => {
        expect(typeof type).toBe("string");
        expect(["info", "warning", "success", "failure"]).toContain(type);
      });
    });
  });

  describe("NotificationContext", () => {
    it("should accept a valid NotificationContext object", () => {
      const context: NotificationContext = {
        userRequest: "user message",
        agentResponse: "agent response",
        question: "what is this?",
        options: ["option1", "option2"],
        todoStatus: "3/5 completed",
        taskName: "background task",
        toolName: "my-tool",
        action: "execute",
      };

      expect(typeof context.userRequest).toBe("string");
      expect(typeof context.agentResponse).toBe("string");
      expect(Array.isArray(context.options)).toBe(true);
    });

    it("should accept NotificationContext with undefined fields", () => {
      const context: NotificationContext = {
        userRequest: undefined,
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      };

      expect(context.userRequest).toBeUndefined();
      expect(context.agentResponse).toBeUndefined();
    });
  });

  describe("NotificationPayload", () => {
    it("should accept a valid NotificationPayload object", () => {
      const payload: NotificationPayload = {
        type: "idle",
        title: "Idle Notification",
        context: {
          userRequest: "test",
          agentResponse: undefined,
          question: undefined,
          options: undefined,
          todoStatus: undefined,
          taskName: undefined,
          toolName: undefined,
          action: undefined,
        },
      };

      expect(typeof payload.type).toBe("string");
      expect(typeof payload.title).toBe("string");
      expect(typeof payload.context).toBe("object");
      expect(["idle", "question", "background", "permission"]).toContain(payload.type);
    });

    it("should accept NotificationPayload with all event types", () => {
      const eventTypes: HookEventType[] = ["idle", "question", "background", "permission"];

      eventTypes.forEach((eventType) => {
        const payload: NotificationPayload = {
          type: eventType,
          title: `${eventType} event`,
          context: {
            userRequest: undefined,
            agentResponse: undefined,
            question: undefined,
            options: undefined,
            todoStatus: undefined,
            taskName: undefined,
            toolName: undefined,
            action: undefined,
          },
        };

        expect(payload.type).toBe(eventType);
      });
    });
  });

  describe("FormattedNotification", () => {
    it("should accept a valid FormattedNotification object", () => {
      const notification: FormattedNotification = {
        title: "Test Title",
        body: "Test body content",
        notificationType: "info",
      };

      expect(typeof notification.title).toBe("string");
      expect(typeof notification.body).toBe("string");
      expect(typeof notification.notificationType).toBe("string");
      expect(["info", "warning", "success", "failure"]).toContain(notification.notificationType);
    });

    it("should accept all AppriseNotificationType values", () => {
      const types: AppriseNotificationType[] = ["info", "warning", "success", "failure"];

      types.forEach((type) => {
        const notification: FormattedNotification = {
          title: "Title",
          body: "Body",
          notificationType: type,
        };

        expect(notification.notificationType).toBe(type);
      });
    });
  });
});
