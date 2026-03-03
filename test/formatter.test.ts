import { describe, expect, it } from "bun:test";
import { formatNotification, formatTodoStatus, truncateText } from "../src/formatter.js";
import type { NotificationContext, NotificationPayload } from "../src/types.js";

const emptyContext: NotificationContext = {
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
    expect(formatted.body).toContain("Request: Ship task 6");
    expect(formatted.body).toContain("Response: Formatter and tests added");
    expect(formatted.body).toContain("Todo: ✅ 2 done | ▶️ 1 in_progress");
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
    expect(formatted.body).toContain("Question: Where should we deploy?");
    expect(formatted.body).toContain("Options:\n  1. staging\n  2. production");
  });

  it("formatNotification() for permission includes tool and action", () => {
    const payload = createPayload("permission", {
      ...emptyContext,
      toolName: "Bash",
      action: "Run build",
    });

    const formatted = formatNotification(payload);

    expect(formatted.notificationType).toBe("warning");
    expect(formatted.body).toContain("Tool: Bash");
    expect(formatted.body).toContain("Action: Run build");
  });

  it("truncateText() truncates long input and includes marker", () => {
    const longText = "x".repeat(3000);
    const truncated = truncateText(longText, 1500);

    expect(truncated.length).toBeLessThanOrEqual(1500);
    expect(truncated).toContain("...(truncated)");
  });

  it("truncateText() returns short input unchanged", () => {
    const text = "short text";
    expect(truncateText(text, 1500)).toBe(text);
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

  it("formatNotification() handles empty context without crashing", () => {
    const payload = createPayload("idle", { ...emptyContext });

    const formatted = formatNotification(payload);

    expect(formatted.title).toBe("idle event");
    expect(formatted.notificationType).toBe("info");
    expect(formatted.body).toBe("");
  });
});
