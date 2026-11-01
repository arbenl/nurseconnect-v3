import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { rootRepairContext } from "../root-repair-context.mjs";
import { REPAIR_BASE, REPAIR_FILES } from "../root-repair-policy.mjs";
const source = fileURLToPath(new URL("../../../", import.meta.url));
function fixture(test) {
  const dir = mkdtempSync(join(tmpdir(), "nc-root-context-")), cwd = join(dir, "repo");
  const git = (args) => {
    const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: dir, encoding: "utf8" });
    if (result.status !== 0) throw new Error("Context fixture failed.");
  };
  try {
    git(["clone", "--shared", "--no-checkout", "--quiet", source, cwd]);
    git(["-C", cwd, "checkout", "--quiet", "--detach", REPAIR_BASE]);
    git(["-C", cwd, "update-ref", "refs/remotes/origin/main", REPAIR_BASE]);
    for (const file of REPAIR_FILES) {
      mkdirSync(dirname(join(cwd, file)), { recursive: true });
      writeFileSync(join(cwd, file), readFileSync(join(source, file)));
    }
    test(cwd);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
describe("root repair real-Git/tree identity", () => {
  it("accepts regular candidate files at the fixed observed main", () => fixture((cwd) => {
    expect(rootRepairContext({}, cwd)).toEqual({ mainSha: REPAIR_BASE, errors: [] });
  }));
  it("rejects executable-bit and symlink laundering", () => fixture((cwd) => {
    const file = join(cwd, REPAIR_FILES[0]);
    chmodSync(file, 0o755); expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/mode/);
    rmSync(file); symlinkSync(join(cwd, REPAIR_FILES[1]), file);
    expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/mode/);
  }));
  it("rejects index mode laundering despite regular worktree mode", () => fixture((cwd) => {
    const file = REPAIR_FILES[0];
    const result = spawnSync("git", ["update-index", "--chmod=+x", "--", file], { cwd, encoding: "utf8" });
    expect(result.status).toBe(0); chmodSync(join(cwd, file), 0o644);
    expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/index mode/);
  }));
  it("rejects tracked deletion hidden by recreated regular worktree bytes", () => fixture((cwd) => {
    const file = REPAIR_FILES[0];
    expect(spawnSync("git", ["update-index", "--force-remove", "--", file], { cwd }).status).toBe(0);
    expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/index mode/);
    const commit = spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "user.name=Fixture",
      "-c", "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "Synthetic deletion fixture"], { cwd });
    expect(commit.status).toBe(0);
    expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/protected tree mode/);
  }));
  it("rejects pull_request_target even with valid same-repository metadata", () => fixture((cwd) => {
    const event = join(cwd, "event.json");
    writeFileSync(event, JSON.stringify({ pull_request: { base: { ref: "main", sha: REPAIR_BASE,
      repo: { full_name: "arbenl/nurseconnect-v3" } }, head: { sha: REPAIR_BASE, repo: { full_name: "arbenl/nurseconnect-v3" } } } }));
    const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REPOSITORY: "arbenl/nurseconnect-v3", GITHUB_EVENT_PATH: event };
    expect(rootRepairContext(env, cwd).errors.join(" ")).toMatch(/event must be pull_request/);
    expect(rootRepairContext({ ...env, GITHUB_EVENT_NAME: "pull_request" }, cwd).errors).toEqual([]);
  }));
  it("rejects missing files and untrusted PR identities", () => fixture((cwd) => {
    const event = join(cwd, "event.json");
    const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "arbenl/nurseconnect-v3", GITHUB_EVENT_PATH: event };
    writeFileSync(event, JSON.stringify({ pull_request: { base: { ref: "main", sha: REPAIR_BASE,
      repo: { full_name: "arbenl/nurseconnect-v3" } }, head: { sha: REPAIR_BASE, repo: { full_name: "attacker/nurseconnect-v3" } } } }));
    expect(rootRepairContext(env, cwd).errors.join(" ")).toMatch(/PR identity/);
    rmSync(join(cwd, REPAIR_FILES[0])); expect(rootRepairContext({}, cwd).errors.length).toBeGreaterThan(0);
  }));
});
