import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { checkAppriseInstalled, sendNotification } from "../src/notifier.js";
import type { FormattedNotification, PluginConfig } from "../src/types.js";

interface MockSpawnResult {
  exited: Promise<number>;
  stderr: ReadableStream<Uint8Array>;
}

function createMockProcess(exitCode: number, stderrText = ""): ReturnType<typeof Bun.spawn> {
  const stderr = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(stderrText));
      controller.close();
    },
  });

  const result: MockSpawnResult = {
    exited: Promise.resolve(exitCode),
    stderr,
  };

  return result as unknown as ReturnType<typeof Bun.spawn>;
}

const baseConfig: PluginConfig = {
  idleDelayMs: 3000,
  truncateLength: 1500,
  deduplication: true,
  tag: undefined,
};

const baseNotification: FormattedNotification = {
  title: "Build Complete",
  body: "Everything passed",
  notificationType: "success",
};

describe("Notifier Module", () => {
  afterEach(() => {
    mock.restore();
  });

  it("checkAppriseInstalled() returns true when apprise exists", async () => {
    const spawnSpy = spyOn(Bun, "spawn").mockReturnValue(createMockProcess(0));

    const installed = await checkAppriseInstalled();

    expect(installed).toBe(true);
    expect(spawnSpy).toHaveBeenCalledWith(["apprise", "--version"], expect.any(Object));
  });

  it("checkAppriseInstalled() returns false when apprise is missing", async () => {
    spyOn(Bun, "spawn").mockReturnValue(createMockProcess(1, "command not found"));

    const installed = await checkAppriseInstalled();

    expect(installed).toBe(false);
  });

  it("sendNotification() builds args without URLs or --config", async () => {
    const spawnSpy = spyOn(Bun, "spawn").mockReturnValue(createMockProcess(0));

    const result = await sendNotification(baseConfig, baseNotification);

    expect(result).toEqual({ success: true, exitCode: 0, stderr: "" });
    expect(spawnSpy).toHaveBeenCalledWith(
      [
        "apprise",
        "-t",
        "Build Complete",
        "-b",
        "Everything passed",
        "--notification-type",
        "success",
      ],
      expect.objectContaining({ timeout: 30_000, stderr: "pipe" })
    );
  });

  it("sendNotification() adds --tag when tag is set", async () => {
    const spawnSpy = spyOn(Bun, "spawn").mockReturnValue(createMockProcess(0));
    const config: PluginConfig = {
      ...baseConfig,
      tag: "opencode",
    };

    await sendNotification(config, baseNotification);

    expect(spawnSpy).toHaveBeenCalledWith(
      expect.arrayContaining(["--tag", "opencode"]),
      expect.any(Object)
    );
  });

  it("sendNotification() returns success false for non-zero exit", async () => {
    spyOn(Bun, "spawn").mockReturnValue(createMockProcess(2, "invalid destination"));

    const result = await sendNotification(baseConfig, baseNotification);

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("invalid destination");
  });

  it("sendNotification() handles spawn errors gracefully", async () => {
    spyOn(Bun, "spawn").mockImplementation(() => {
      throw new Error("Process timed out");
    });

    const result = await sendNotification(baseConfig, baseNotification);

    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain("Process timed out");
  });
});
