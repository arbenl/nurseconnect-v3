import path from "node:path";
import { spawnSync } from "node:child_process";

export function discoverRepoRoot(startCwd = process.cwd()) {
  const resolvedStart = path.resolve(startCwd);
  const probe = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: resolvedStart,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (probe.status === 0) {
    const root = String(probe.stdout || "").trim();
    if (root) {
      return path.resolve(root);
    }
  }

  return resolvedStart;
}
