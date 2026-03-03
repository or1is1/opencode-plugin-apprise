import { describe, expect, it } from "bun:test";
import { formatNotification, formatTodoStatus } from "../src/formatter.js";
import type { NotificationContext, NotificationPayload } from "../src/types.js";

const emptyContext: NotificationContext = {
  sessionTitle: undefined,
  userRequest: undefined,
  agentResponse: undefined,
  question: undefined,
  options: undefined,
  todoStatus: undefined,
  toolName: undefined,
  action: undefined,
};

function createPayload(type: NotificationPayload["type"], context: NotificationContext): NotificationPayload {
  return {
    type,
    title: `${type} event`,
    context,
  };
}

describe("Formatter Module", () => {
  it("formatNotification() for idle includes request, response, and todo", () => {
    const payload = createPayload("idle", {
      ...emptyContext,
      userRequest: "Ship task 6",
      agentResponse: "Formatter and tests added",
      todoStatus: "✅ 2 done | ▶️ 1 in_progress",
    });

    const formatted = formatNotification(payload);

    expect(formatted.notificationType).toBe("info");
    expect(formatted.body).toContain("📝 REQUEST: Ship task 6");
    expect(formatted.body).toContain("🤖 RESPONSE: Formatter and tests added");
    expect(formatted.body).toContain("📋 TODO: ✅ 2 done | ▶️ 1 in_progress");
  });

  it("formatNotification() for question includes question and options", () => {
    const payload = createPayload("question", {
      ...emptyContext,
      userRequest: "Pick deployment target",
      question: "Where should we deploy?",
      options: ["staging", "production"],
    });

    const formatted = formatNotification(payload);

    expect(formatted.notificationType).toBe("warning");
    expect(formatted.body).toContain("❓ QUESTION: Where should we deploy?");
    expect(formatted.body).toContain("OPTIONS:\n  1. staging\n  2. production");
  });

  it("formatNotification() for permission includes tool and action", () => {
    const payload = createPayload("permission", {
      ...emptyContext,
      toolName: "Bash",
      action: "Run build",
    });

    const formatted = formatNotification(payload);

    expect(formatted.notificationType).toBe("warning");
    expect(formatted.body).toContain("🔧 TOOL: Bash");
    expect(formatted.body).toContain("⚡ ACTION: Run build");
  });

  it("formatTodoStatus() summarizes mixed todo statuses", () => {
    const status = formatTodoStatus([
      { status: "completed", content: "done 1" },
      { status: "completed", content: "done 2" },
      { status: "in_progress", content: "doing" },
      { status: "pending", content: "next" },
      { status: "pending", content: "later" },
    ]);

    expect(status).toBe("✅ 2 done | ▶️ 1 in_progress | ⚪ 2 pending");
  });

  it("formatNotification() for idle includes sessionTitle when present", () => {
    const payload = createPayload("idle", {
      ...emptyContext,
      sessionTitle: "Apprise plugin v1.2.4 test",
      userRequest: "Test notification",
      todoStatus: "✅ 3 done",
    });

    const formatted = formatNotification(payload);

    expect(formatted.body).toContain("📌 TITLE: Apprise plugin v1.2.4 test");
    expect(formatted.body).toContain("📝 REQUEST: Test notification");
    expect(formatted.body).toContain("📋 TODO: ✅ 3 done");
    const titleIndex = formatted.body.indexOf("📌 TITLE:");
    const requestIndex = formatted.body.indexOf("📝 REQUEST:");
    expect(titleIndex).toBeLessThan(requestIndex);
  });

  it("formatNotification() for question includes sessionTitle when present", () => {
    const payload = createPayload("question", {
      ...emptyContext,
      sessionTitle: "Deploy pipeline setup",
      question: "Which environment?",
      options: ["dev", "prod"],
    });

    const formatted = formatNotification(payload);

    expect(formatted.body).toContain("📌 TITLE: Deploy pipeline setup");
    expect(formatted.body).toContain("❓ QUESTION: Which environment?");
  });

  it("formatNotification() separates fields with a visual divider line", () => {
    const payload = createPayload("idle", {
      ...emptyContext,
      sessionTitle: "Test session",
      userRequest: "Do something",
      agentResponse: "Done",
    });

    const formatted = formatNotification(payload);

    expect(formatted.body).toContain("────────────────────");
    const segments = formatted.body.split("────────────────────");
    expect(segments.length).toBe(3);
  });

  it("formatNotification() has no divider when only one field is present", () => {
    const payload = createPayload("idle", {
      ...emptyContext,
      userRequest: "Solo field",
    });

    const formatted = formatNotification(payload);

    expect(formatted.body).toBe("📝 REQUEST: Solo field");
    expect(formatted.body).not.toContain("────────────────────");
  });

  it("formatNotification() handles empty context without crashing", () => {
    const payload = createPayload("idle", { ...emptyContext });

    const formatted = formatNotification(payload);

    expect(formatted.title).toBe("idle event");
    expect(formatted.notificationType).toBe("info");
    expect(formatted.body).toBe("");
  });
});
