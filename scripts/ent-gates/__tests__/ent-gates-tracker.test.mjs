import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "../check.mjs";
import { cleanGitEnv, collectSpecialChangedFiles } from "../evidence.mjs";
import { BOOTSTRAP_FILES } from "../promotion-policy.mjs";
import { validateEntGateEvidence } from "../../lib/pr-ent-gate-evidence.mjs";
const bootstrapBase = "e8b3c5c38650ed3bcc0d64de538cc4247598f49a", evidenceFor = (file) => `ent-gates: PASS\nevidence/ent-gates.md\nmanifest sha256: ${createHash("sha256").update(readFileSync(file)).digest("hex")}`, historyIt = [bootstrapBase, "430dc4b48ea075b850921db56ffd87206e2a1ae5"].every((ref) => spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], { env: cleanGitEnv() }).status === 0) ? it : it.skip;
const bootstrapArgs = (root, extra = []) => ["--base", bootstrapBase, "--policy-base", bootstrapBase, "--run-root", root,
  "--changed-files-complete", "true",
  ...BOOTSTRAP_FILES.flatMap((file) => ["--changed-file", file]),
  ...extra,
];
describe("enterprise gate tracker promotion checks", () => {
  it("fails closed when tracker promotion changes without a base tracker", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const result = run(["--base", "HEAD", "--enforce-promotion", "true", "--run-root", root,
        "--changed-file", "docs/plans/current-tracker.md"], {});
      expect(result.errors.join("\n")).toContain("base tracker is unavailable");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("does not exempt pull requests whose source branch is named main", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const result = run(["--base", "HEAD", "--run-root", root, "--changed-file", "docs/plans/current-tracker.md"],
        { GITHUB_HEAD_REF: "main", GITHUB_BASE_REF: "main" });
      expect(result.errors.join("\n")).toContain("base tracker is unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("uses the base tracker for promotion even when the PR tracker is unchanged", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-tracker-"));
    try {
      const result = run(["--base", "HEAD", "--run-root", root, "--changed-file", "docs/example.md"],
        { GITHUB_BASE_REF: "main" });
      expect(result.errors.join("\n")).toContain("base tracker is unavailable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  historyIt("always enforces bootstrap mode and records policy identity", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-bootstrap-"));
    try {
      const event = join(root, "event.json");
      writeFileSync(event, JSON.stringify({ pull_request: { head: { repo: { full_name: "arbenl/nurseconnect-v3" } } } }));
      const githubEnv = {
        GITHUB_ACTIONS: "true", GITHUB_BASE_REF: "main", GITHUB_HEAD_REF: "codex/ent-gate-null-promotion-bootstrap",
        GITHUB_REPOSITORY: "arbenl/nurseconnect-v3", GITHUB_EVENT_PATH: event,
      };
      const result = run(bootstrapArgs(root, ["--enforce-promotion", "false"]), githubEnv);
      expect(result.errors).toContain("Special promotion mode cannot disable promotion enforcement.");
      const evidence = readFileSync(join(root, "evidence/ent-gates.md"), "utf8");
      expect(evidence).toContain("promotion mode: bootstrap");
      expect(evidence).toContain(`policy base sha: ${bootstrapBase}`);
      expect(evidence).toContain("source branch: codex/ent-gate-null-promotion-bootstrap");
      writeFileSync(event, JSON.stringify({ pull_request: { head: { repo: { full_name: "attacker/nurseconnect-v3" } } } }));
      expect(run(bootstrapArgs(root), githubEnv).errors.join("\n")).toContain("source branch is invalid");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  historyIt.each([
    ["missing base", ["--policy-base", "refs/heads/missing"], {}, "Unable to load base tracker"],
    ["diff/policy base mismatch", ["--base", "430dc4b48ea075b850921db56ffd87206e2a1ae5"], {}, "diff base must resolve to the policy base"],
    ["conflicting branch metadata", [], { GITHUB_HEAD_REF: "codex/other" }, "source branch is invalid"],
    ["tracker override", ["--tracker", "docs/plans/other.md"], {}, "cannot override the canonical tracker path"],
  ])("fails closed for special-mode %s", (_label, extra, env, message) => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-bootstrap-"));
    try {
      expect(run(bootstrapArgs(root, extra), env).errors.join("\n")).toContain(message);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  historyIt("preserves standard validation against the historical promoted base", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-gates-standard-"));
    const manifest = join(root, "slice-gates.yaml");
    writeFileSync(manifest, "slice: NC-TB-02\nbranch: codex/tenant-observe\ngates:\n  ent-tm:\n    status: n/a\n    justification: Fixture is unguarded.\n  ent-dlv:\n    status: n/a\n    justification: Fixture is unguarded.\n  ent-perf:\n    status: n/a\n    justification: Fixture is unguarded.\n");
    try {
      const result = run(["--base", "430dc4b48ea075b850921db56ffd87206e2a1ae5", "--manifest", manifest,
        "--run-root", root, "--changed-files-complete", "true", "--changed-file", "docs/example.md"], {});
      expect(result.errors).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
  it("separates local structural validation from real-base promotion enforcement", () => {
    const localErrors = [];
    validateEntGateEvidence(localErrors, evidenceFor("slice-gates.yaml"), "slice-gates.yaml", BOOTSTRAP_FILES,
      { env: { PR_FILES_COMPLETE: "1" } });
    expect(localErrors).toEqual([]);
    let invoked = [];
    const realErrors = [];
    validateEntGateEvidence(realErrors, evidenceFor("slice-gates.yaml"), "slice-gates.yaml", [], {
      env: { GATE_POLICY_BASE: bootstrapBase, PR_FILES_COMPLETE: "1" },
      spawn: (_command, args) => { invoked = args; return { status: 0, stdout: "", stderr: "" }; },
    });
    expect(realErrors).toEqual([]);
    expect(invoked).toEqual(expect.arrayContaining([bootstrapBase, "--enforce-promotion", "true"]));
    expect(invoked).not.toContain("false");
  });
  it.each([
    ["incomplete fixture", {}, "declared complete file list"],
    ["CI=1 without base", { CI: "1", PR_FILES_COMPLETE: "1" }, "requires BASE_COMMIT"],
    ["PR head without base", { GITHUB_HEAD_REF: "codex/pr", PR_FILES_COMPLETE: "1" }, "requires BASE_COMMIT"],
  ])("rejects %s", (_label, env, message) => {
    const errors = [];
    validateEntGateEvidence(errors, evidenceFor("slice-gates.yaml"), "slice-gates.yaml", BOOTSTRAP_FILES, { env });
    expect(errors.join("\n")).toContain(message);
  });
  it("rejects malformed structural manifests, guarded n/a paths, and SHA mismatch", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-structural-"));
    const manifest = join(root, "slice-gates.yaml");
    const config = join(root, "paths.json");
    try {
      writeFileSync(manifest, "unknown: value\n");
      writeFileSync(config, JSON.stringify({ gates: { "ent-tm": ["apps/**"], "ent-dlv": [], "ent-perf": [] } }));
      const errors = [];
      validateEntGateEvidence(errors, `ent-gates: PASS\nevidence/ent-gates.md\nmanifest sha256: ${"0".repeat(64)}`, manifest, ["apps/runtime.ts"],
        { env: { PR_FILES_COMPLETE: "1" }, configPath: config });
      expect(errors.join("\n")).toMatch(/sha mismatch[\s\S]*Unknown manifest key/);
      writeFileSync(manifest, "slice: NC-X\nbranch: codex/x\ngates:\n  ent-tm: { status: n/a, justification: This guarded fixture must fail closed. }\n  ent-dlv: { status: n/a, justification: This fixture does not alter lifecycle behavior. }\n  ent-perf: { status: n/a, justification: This fixture does not alter performance behavior. }\n");
      const guarded = [];
      validateEntGateEvidence(guarded, evidenceFor(manifest), manifest, ["apps/runtime.ts"],
        { env: { PR_FILES_COMPLETE: "1" }, configPath: config });
      expect(guarded.join("\n")).toContain("ent-tm cannot be n/a");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it("decomposes renames in a shallow direct-parent checkout", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-rename-")); const gitEnv = cleanGitEnv(); const inherited = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE, GIT_INDEX_FILE: process.env.GIT_INDEX_FILE };
    const git = (args) => expect(spawnSync("git", args, { cwd: root, env: gitEnv }).status).toBe(0);
    try {
      git(["init", "-q"]); mkdirSync(join(root, "scripts")); writeFileSync(join(root, "scripts/runtime.mjs"), "export {};\n");
      git(["add", "."]); git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "base"]); const forged = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", env: gitEnv }).stdout.trim();
      writeFileSync(join(root, "marker.txt"), "mid\n"); git(["add", "."]); git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", "mid"]); const parent = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", env: gitEnv }).stdout.trim();
      mkdirSync(join(root, "docs/plans"), { recursive: true }); renameSync(join(root, "scripts/runtime.mjs"), join(root, "docs/plans/authorized.md"));
      git(["add", "."]); git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-qm", `head\n\nparent ${forged}`]); const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", env: gitEnv }).stdout.trim();
      writeFileSync(join(root, ".git/shallow"), `${head}\n`);
      const decoy = join(root, "decoy"); mkdirSync(decoy); expect(spawnSync("git", ["init", "-q"], { cwd: decoy, env: gitEnv }).status).toBe(0); process.env.GIT_DIR = join(decoy, ".git"); process.env.GIT_WORK_TREE = decoy; process.env.GIT_INDEX_FILE = join(decoy, ".git/index");
      expect(cleanGitEnv({ Git_Dir: "decoy", PATH: "/bin" })).toEqual({ PATH: "/bin" });
      expect(collectSpecialChangedFiles(parent, root)).toEqual(expect.arrayContaining(["scripts/runtime.mjs", "docs/plans/authorized.md"]));
      expect(() => collectSpecialChangedFiles(forged, root)).toThrow("not descended");
    } finally { for (const [key, value] of Object.entries(inherited)) if (value === undefined) delete process.env[key]; else process.env[key] = value; rmSync(root, { recursive: true, force: true }); }
  });
});
