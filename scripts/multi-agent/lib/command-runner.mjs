import { spawn } from "node:child_process";

const DEFAULT_TIMEOUT_MS = 300000;

export async function runShellCommand(command, options = {}) {
  const {
    cwd,
    env = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    dryRun = false,
  } = options;

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();

  if (dryRun) {
    const finishedAt = new Date().toISOString();
    return {
      command,
      status: "pass",
      exitCode: 0,
      stdout: `[dry-run] ${command}`,
      stderr: "",
      signal: null,
      timedOut: false,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
    };
  }

  return new Promise((resolve) => {
    const child = spawn(command, {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeoutHandle =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, timeoutMs)
        : null;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      const finishedAt = new Date().toISOString();
      resolve({
        command,
        status: "fail",
        exitCode: -1,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
        signal: null,
        timedOut,
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,
      });
    });

    child.on("close", (code, signal) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      const finishedAt = new Date().toISOString();
      const passed = code === 0 && !timedOut;
      resolve({
        command,
        status: passed ? "pass" : "fail",
        exitCode: Number.isInteger(code) ? code : -1,
        stdout,
        stderr,
        signal,
        timedOut,
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,
      });
    });
  });
}
