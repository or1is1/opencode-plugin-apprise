import { mock } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { DedupChecker } from "../src/dedup.js";
import type { PluginConfig } from "../src/types.js";

export type MockClient = {
  session: {
    get: ReturnType<typeof mock>;
    messages: ReturnType<typeof mock>;
    todo: ReturnType<typeof mock>;
  };
};

export type MinimalMockClient = {
  session: {
    get: ReturnType<typeof mock>;
  };
};

export function makeInput(client: MockClient | MinimalMockClient): PluginInput {
  return { client } as unknown as PluginInput;
}

export function makeDefaultInput(title: string = "Test Session"): PluginInput {
  const client: MinimalMockClient = {
    session: {
      get: mock(() => Promise.resolve({ data: { title } })),
    },
  };
  return makeInput(client);
}

export function makeConfig(): PluginConfig {
  return {
    tag: undefined,
  };
}

export function makeDedup(isDuplicateResult: boolean = false): DedupChecker {
  return {
    isDuplicate: mock(() => isDuplicateResult),
    clear: mock(() => {}),
  };
}
