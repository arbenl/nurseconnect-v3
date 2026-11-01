import { readFileSync, writeFileSync, mkdirSync, chmodSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { rootRepairContext } from "../root-repair-context.mjs";
import { REPAIR_BASE, REPAIR_FILES } from "../root-repair-policy.mjs";
import { rootRepairFixture as fixture } from "./bootstrap-fixture.mjs";
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
    for (const file of [REPAIR_FILES[0], REPAIR_FILES.at(-1)]) {
      const result = spawnSync("git", ["update-index", "--chmod=+x", "--", file], { cwd, encoding: "utf8" });
      expect(result.status).toBe(0); chmodSync(join(cwd, file), 0o644);
      expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/index mode/);
      expect(spawnSync("git", ["update-index", "--chmod=-x", "--", file], { cwd }).status).toBe(0);
    }
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

it("validates raw merge parent headers even at a shallow boundary", () => fixture((cwd) => {
  const git = (args) => {
    const p = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8" });
    expect(p.status, p.stderr).toBe(0); return p.stdout.trim();
  };
  git(["add", "--", ...REPAIR_FILES]);
  const tree = git(["write-tree"]);
  const identity = ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid"];
  const head = git([...identity, "commit-tree", tree, "-p", REPAIR_BASE, "-m", "Synthetic head"]);
  const merge = git([...identity, "commit-tree", tree, "-p", REPAIR_BASE, "-p", head, "-m", "Synthetic merge"]);
  git(["reset", "--hard", merge]);
  const event = join(cwd, "event.json");
  writeFileSync(event, JSON.stringify({ pull_request: { base: { ref: "main", sha: REPAIR_BASE,
    repo: { full_name: "arbenl/nurseconnect-v3" } }, head: { sha: head, repo: { full_name: "arbenl/nurseconnect-v3" } } } }));
  const env = { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "arbenl/nurseconnect-v3", GITHUB_EVENT_PATH: event };
  expect(rootRepairContext(env, cwd).errors).toEqual([]);
  writeFileSync(join(cwd, ".git/shallow"), merge + "\n");
  expect(rootRepairContext(env, cwd).errors).toEqual([]);
  writeFileSync(event, JSON.stringify({ pull_request: { base: { ref: "main", sha: REPAIR_BASE,
    repo: { full_name: "arbenl/nurseconnect-v3" } }, head: { sha: REPAIR_BASE, repo: { full_name: "arbenl/nurseconnect-v3" } } } }));
  expect(rootRepairContext(env, cwd).errors.join(" ")).toMatch(/expected merge/);
}));

it("rejects replace refs instead of validating substituted commit objects", () => fixture((cwd) => {
  const git = (args) => {
    const p = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd, encoding: "utf8" });
    expect(p.status, p.stderr).toBe(0); return p.stdout.trim();
  };
  const tree = git(["rev-parse", "HEAD^{tree}"]);
  const replacement = git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit-tree", tree, "-m", "Synthetic replacement"]);
  git(["replace", REPAIR_BASE, replacement]);
  expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/replace refs/);
}));

it("rejects a merge header whose event head object is missing", () => fixture((cwd) => {
  const git = (args, input) => {
    const p = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd, input, encoding: "utf8" });
    expect(p.status, p.stderr).toBe(0); return p.stdout.trim();
  };
  git(["add", "--", ...REPAIR_FILES]);
  const tree = git(["write-tree"]), missing = "f".repeat(40);
  const raw = `tree ${tree}\nparent ${REPAIR_BASE}\nparent ${missing}\nauthor Fixture <fixture@example.invalid> 1 +0000\ncommitter Fixture <fixture@example.invalid> 1 +0000\n\nSynthetic missing-parent fixture\n`;
  const merge = git(["hash-object", "-t", "commit", "-w", "--stdin"], raw);
  git(["reset", "--hard", merge]);
  const event = join(cwd, "event.json");
  writeFileSync(event, JSON.stringify({ pull_request: { base: { ref: "main", sha: REPAIR_BASE,
    repo: { full_name: "arbenl/nurseconnect-v3" } }, head: { sha: missing, repo: { full_name: "arbenl/nurseconnect-v3" } } } }));
  expect(rootRepairContext({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request",
    GITHUB_REPOSITORY: "arbenl/nurseconnect-v3", GITHUB_EVENT_PATH: event }, cwd).errors.length).toBeGreaterThan(0);
}));

it("bounds Git process work while checking the complete valid inventory", () => fixture((cwd) => {
  const real = spawnSync("which", ["git"], { encoding: "utf8" }).stdout.trim();
  const bin = join(cwd, "git-bin"), count = join(cwd, "git-read-count");
  mkdirSync(bin);
  writeFileSync(join(bin, "git"), '#!/bin/sh\nprintf . >> "$NC_CONTEXT_COUNT"\nexec "$NC_CONTEXT_GIT" "$@"\n', { mode: 0o755 });
  const saved = Object.fromEntries(["PATH", "NC_CONTEXT_COUNT", "NC_CONTEXT_GIT"].map((name) => [name, process.env[name]]));
  try {
    Object.assign(process.env, { PATH: bin + ":" + saved.PATH, NC_CONTEXT_COUNT: count, NC_CONTEXT_GIT: real });
    expect(rootRepairContext({}, cwd).errors).toEqual([]);
    expect(readFileSync(count, "utf8").length).toBeLessThanOrEqual(10);
  } finally {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}));

it("rejects actual unmerged index entries", () => fixture((cwd) => {
  const file = "config/nc-governance-fixture-repair.json";
  const object = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd, input: "synthetic\n", encoding: "utf8" });
  expect(object.status).toBe(0);
  const oid = object.stdout.trim();
  const index = spawnSync("git", ["update-index", "--index-info"], { cwd, encoding: "utf8",
    input: `100644 ${oid} 1\t${file}\n100644 ${oid} 2\t${file}\n` });
  expect(index.status).toBe(0);
  expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/index mode/);
}));

it("rejects a new allowed path replaced with a HEAD directory", () => fixture((cwd) => {
  const file = "config/nc-governance-fixture-repair.json", target = join(cwd, file), data = readFileSync(target);
  rmSync(target); mkdirSync(target); writeFileSync(join(target, "nested"), "synthetic\n");
  expect(spawnSync("git", ["add", "--", ...REPAIR_FILES], { cwd }).status).toBe(0);
  expect(spawnSync("git", ["-c", "core.hooksPath=/dev/null", "-c", "user.name=Fixture", "-c",
    "user.email=fixture@example.invalid", "commit", "--quiet", "-m", "Synthetic directory"], { cwd }).status).toBe(0);
  rmSync(target, { recursive: true }); writeFileSync(target, data);
  expect(spawnSync("git", ["add", "--", file], { cwd }).status).toBe(0);
  expect(rootRepairContext({}, cwd).errors.join(" ")).toMatch(/protected tree mode/);
}));
