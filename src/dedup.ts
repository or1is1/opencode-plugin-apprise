import type { NotificationPayload } from "./types.js";

export interface DedupChecker {
  isDuplicate(payload: NotificationPayload): boolean;
  clear(): void;
}

export function createDedupChecker(): DedupChecker {
  const TTL_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_SIZE = 100;

  const seen = new Map<string, number>();

  function hashPayload(payload: NotificationPayload): string {
    const key = `${payload.type}:${payload.title}:${payload.context.userRequest ?? ""}:${payload.context.question ?? ""}`;
    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) ^ key.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }

  function evictExpired(): void {
    const now = Date.now();
    for (const [hash, ts] of seen) {
      if (now - ts > TTL_MS) seen.delete(hash);
    }
  }

  function evictOldestIfFull(): void {
    if (seen.size >= MAX_SIZE) {
      const firstKey = seen.keys().next().value;
      if (firstKey !== undefined) seen.delete(firstKey);
    }
  }

  return {
    isDuplicate(payload: NotificationPayload): boolean {
      evictExpired();
      const hash = hashPayload(payload);
      if (seen.has(hash)) return true;
      evictOldestIfFull();
      seen.set(hash, Date.now());
      return false;
    },
    clear(): void {
      seen.clear();
    },
  };
}
