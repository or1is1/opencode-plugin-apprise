import type { Hooks, Plugin } from "@opencode-ai/plugin";
import { loadConfig, validateConfig } from "./config.js";
import { createDedupChecker } from "./dedup.js";
import { createIdleHook } from "./hooks/idle.js";
import { createPermissionHooks } from "./hooks/permission.js";
import { createQuestionHook } from "./hooks/question.js";
import { checkAppriseInstalled } from "./notifier.js";
import type { PluginConfig } from "./types.js";

const plugin: Plugin = async (input) => {
  let config: PluginConfig;
  try {
    config = loadConfig();
    validateConfig(config);
  } catch (err: unknown) {
    console.warn(
      "[opencode-plugin-apprise] Configuration error:",
      err instanceof Error ? err.message : err
    );
    console.warn("[opencode-plugin-apprise] Plugin disabled due to configuration error.");
    return {};
  }

  const appriseInstalled = await checkAppriseInstalled();
  if (!appriseInstalled) {
    console.warn("[opencode-plugin-apprise] apprise CLI not found. Install with: pip install apprise");
    console.warn("[opencode-plugin-apprise] Plugin disabled.");
    return {};
  }

  const dedup = createDedupChecker();
  const interactiveSessions = new Set<string>();

  const idleHook = createIdleHook(input, config, dedup, interactiveSessions);
  const questionHook = createQuestionHook(config, dedup);
  const permissionHooks = createPermissionHooks(config, dedup);

  const combinedEventHook: NonNullable<Hooks["event"]> = async ({ event }) => {
    await questionHook({ event });
    await permissionHooks.eventFallback({ event });
    await idleHook({ event });
  };

  const chatMessageHook: NonNullable<Hooks["chat.message"]> = async (input) => {
    interactiveSessions.add(input.sessionID);
  };

  return {
    event: combinedEventHook,
    "permission.ask": permissionHooks.permissionAsk,
    "chat.message": chatMessageHook,
  };
};

export default plugin;
