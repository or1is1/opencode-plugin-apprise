import { describe, it, expect, beforeEach } from "bun:test";
import { createDedupChecker } from "../src/dedup.js";
import type { NotificationPayload } from "../src/types.js";

describe("Dedup Module", () => {
  let payload1: NotificationPayload;
  let payload2: NotificationPayload;

  beforeEach(() => {
    payload1 = {
      type: "idle",
      title: "Test Notification",
      context: {
        userRequest: "What is 2+2?",
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };

    payload2 = {
      type: "question",
      title: "Different Notification",
      context: {
        userRequest: "What is 3+3?",
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };
  });

  it("Test 1: Same payload called twice → first returns false, second returns true", () => {
    const checker = createDedupChecker();

    const firstCall = checker.isDuplicate(payload1);
    expect(firstCall).toBe(false); // First call should not be a duplicate

    const secondCall = checker.isDuplicate(payload1);
    expect(secondCall).toBe(true); // Second call with same payload should be duplicate
  });

  it("Test 2: Different payloads → both return false", () => {
    const checker = createDedupChecker();

    const result1 = checker.isDuplicate(payload1);
    expect(result1).toBe(false);

    const result2 = checker.isDuplicate(payload2);
    expect(result2).toBe(false); // Different payload should not be duplicate
  });

  it("Test 4: clear() resets state — after clear, same payload returns false again", () => {
    const checker = createDedupChecker();

    const firstCall = checker.isDuplicate(payload1);
    expect(firstCall).toBe(false);

    const secondCall = checker.isDuplicate(payload1);
    expect(secondCall).toBe(true); // Duplicate before clear

    checker.clear();

    const afterClear = checker.isDuplicate(payload1);
    expect(afterClear).toBe(false); // After clear, same payload is not duplicate
  });

  it("Test 5: MAX_SIZE eviction — after 100 entries, oldest is evicted (LRU-style)", () => {
    const checker = createDedupChecker();

    // Add 100 unique payloads
    for (let i = 0; i < 100; i++) {
      const payload: NotificationPayload = {
        type: "idle",
        title: `Notification ${i}`,
        context: {
          userRequest: `Request ${i}`,
          agentResponse: undefined,
          question: undefined,
          options: undefined,
          todoStatus: undefined,
          taskName: undefined,
          toolName: undefined,
          action: undefined,
        },
      };
      const result = checker.isDuplicate(payload);
      expect(result).toBe(false); // All should be new
    }

    // Now add one more to trigger eviction
    const payload101: NotificationPayload = {
      type: "idle",
      title: "Notification 100",
      context: {
        userRequest: "Request 100",
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };
    const result101 = checker.isDuplicate(payload101);
    expect(result101).toBe(false); // New entry

    // The first payload should have been evicted
    const firstPayload: NotificationPayload = {
      type: "idle",
      title: "Notification 0",
      context: {
        userRequest: "Request 0",
        agentResponse: undefined,
        question: undefined,
        options: undefined,
        todoStatus: undefined,
        taskName: undefined,
        toolName: undefined,
        action: undefined,
      },
    };
    const resultFirst = checker.isDuplicate(firstPayload);
    expect(resultFirst).toBe(false); // Should be false because it was evicted
  });

  it("Test 6: TTL expiry simulation — after TTL, same payload returns false again", () => {
    const checker = createDedupChecker();

    const firstCall = checker.isDuplicate(payload1);
    expect(firstCall).toBe(false);

    const secondCall = checker.isDuplicate(payload1);
    expect(secondCall).toBe(true); // Duplicate before TTL expiry

    // Mock Date.now to simulate TTL expiry (6 minutes in future)
    const originalDateNow = Date.now;
    Date.now = () => originalDateNow() + 6 * 60 * 1000;

    try {
      const afterTTL = checker.isDuplicate(payload1);
      expect(afterTTL).toBe(false); // After TTL, same payload is not duplicate
    } finally {
      Date.now = originalDateNow; // Restore original Date.now
    }
  });
});
