import type { FormattedNotification, PluginConfig } from "./types.js";

export interface NotifierResult {
  success: boolean;
  exitCode: number;
  stderr: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function checkAppriseInstalled(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["apprise", "--version"], {
      timeout: 30_000,
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

export async function sendNotification(
  config: PluginConfig,
  notification: FormattedNotification
): Promise<NotifierResult> {
  const args: string[] = [
    "apprise",
    "-t",
    notification.title,
    "-b",
    notification.body,
    "--notification-type",
    notification.notificationType,
  ];

  if (config.tag) {
    args.push("--tag", config.tag);
  }

  try {
    const proc = Bun.spawn(args, {
      timeout: 30_000,
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    return {
      success: exitCode === 0,
      exitCode,
      stderr,
    };
  } catch (error: unknown) {
    return {
      success: false,
      exitCode: -1,
      stderr: getErrorMessage(error),
    };
  }
}
