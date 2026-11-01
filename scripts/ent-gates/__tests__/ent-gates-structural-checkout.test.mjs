import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { BOOTSTRAP_FILES } from "../promotion-policy.mjs";
import { parseManifest } from "../manifest.mjs";
import { validateEntGateEvidence } from "../../lib/pr-ent-gate-evidence.mjs";
import { bootstrapFixture, historicalRun } from "./bootstrap-fixture.mjs";

const bootstrapBase = "e8b3c5c38650ed3bcc0d64de538cc4247598f49a";
const evidenceFor = (file) => `ent-gates: PASS\nevidence/ent-gates.md\nmanifest sha256: ${createHash("sha256").update(readFileSync(file)).digest("hex")}`;

describe("isolated bootstrap manifest fixtures", () => {
  it("separates local structural validation from real-base promotion enforcement", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-isolated-"));
    try {
      const manifest = bootstrapFixture(root);

    const localErrors = [];
    validateEntGateEvidence(localErrors, evidenceFor(manifest), manifest, BOOTSTRAP_FILES,
      { env: { PR_FILES_COMPLETE: "1" } });
    expect(localErrors).toEqual([]);
    let invoked = [];
    const realErrors = [];
    validateEntGateEvidence(realErrors, evidenceFor(manifest), manifest, [], {
      env: { GATE_POLICY_BASE: bootstrapBase, PR_FILES_COMPLETE: "1" },
      spawn: (_command, args) => { invoked = args; return { status: 0, stdout: "", stderr: "" }; },
    });
    expect(realErrors).toEqual([]);
    expect(invoked).toEqual(expect.arrayContaining([bootstrapBase, "--enforce-promotion", "true"]));
    expect(invoked).not.toContain("false");

    } finally { rmSync(root, { recursive: true, force: true }); }
  });
  it.each(["standard", "authority", "authority-maintenance"])("does not consume %s ambient manifest", (mode) => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-ent-independent-"));
    try {
      const ambient = join(root, "slice-gates.yaml");
      const source = `slice: NC-X\npromotion-mode: ${mode}\n`;
      writeFileSync(ambient, source);
      const fixture = bootstrapFixture(root);
      expect(fixture).not.toBe(ambient);
      expect(parseManifest(readFileSync(fixture, "utf8")).manifest["promotion-mode"]).toBe("bootstrap");
      expect(readFileSync(ambient, "utf8")).toBe(source);
      const args = ["--base", bootstrapBase, "--policy-base", bootstrapBase, "--manifest", fixture,
        "--run-root", join(root, "result"), "--changed-files-complete", "true",
        ...BOOTSTRAP_FILES.flatMap((file) => ["--changed-file", file])];
      const result = historicalRun(root, args, {}, mode);
      expect(result.errors).toEqual([]);
      expect(JSON.parse(readFileSync(join(root, "result/evidence/ent-gates.json"), "utf8")).promotion.mode).toBe("bootstrap");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

it("Finalizer checkout provisions pinned fixture history and main before local tests", () => {
  const source = fileURLToPath(new URL("../../../", import.meta.url));
  const job = readFileSync(join(source, ".github/workflows/ci.yml"), "utf8").split("  pr-finalizer:")[1];
  const checkout = job.split("- name: Setup Node.js")[0];
  const depth = Number(checkout.match(/fetch-depth:\s*(\d+)/)?.[1] ?? 1);
  const root = mkdtempSync(join(tmpdir(), "nc-finalizer-history-")), remote = join(root, "remote.git"), cwd = join(root, "checkout");
  const git = (args, workdir = source) => {
    const p = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...args], { cwd: workdir, encoding: "utf8" });
    expect(p.status, p.stderr).toBe(0); return p.stdout.trim();
  };
  try {
    git(["clone", "--bare", "--shared", "--quiet", source, remote]);
    git(["--git-dir", remote, "update-ref", "refs/heads/fixture-ci", git(["rev-parse", "HEAD"])]);
    git(["--git-dir", remote, "update-ref", "refs/heads/main", "9882c8b5044d238c398dde8e0ec45b7bf039cc89"]);
    git(["clone", "--quiet", "--no-local", "--no-checkout", "--branch", "fixture-ci", ...(depth ? ["--depth", String(depth)] : []), pathToFileURL(remote).href, cwd]);
    for (const ref of [bootstrapBase, "430dc4b48ea075b850921db56ffd87206e2a1ae5", "9882c8b5044d238c398dde8e0ec45b7bf039cc89", "origin/main"]) {
      expect(spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], { cwd }).status, `Missing fixture ref ${ref}`).toBe(0);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
