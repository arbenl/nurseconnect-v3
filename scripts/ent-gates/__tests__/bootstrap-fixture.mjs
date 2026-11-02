import { existsSync, writeFileSync, mkdtempSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { cleanGitEnv } from "../evidence.mjs";
import { REPAIR_BASE, REPAIR_FILES } from "../root-repair-policy.mjs";

export function bootstrapFixture(root) {
  const file = join(root, "bootstrap.fixture.yaml");
  writeFileSync(file, `slice: NC-EG-06
branch: codex/ent-gate-null-promotion-bootstrap
promotion-mode: bootstrap
gates:
  ent-tm:
    status: required
    evidence: docs/threat-models/nc-eg-06.md
  ent-dlv:
    status: required
    evidence: docs/data-lifecycle/nc-eg-06.md
  ent-perf:
    status: required
    evidence: docs/performance/nc-eg-06.md
`);
  return file;
}

export function historicalRun(root, args, env = {}, ambientMode) {
  const cwd = join(root, "historical-checkout");
  const source = fileURLToPath(new URL("../../../", import.meta.url));
  const git = (argv, workdir = cwd) => {
    const result = spawnSync("git", ["-c", "core.hooksPath=/dev/null", ...argv], { cwd: workdir, env: cleanGitEnv(), encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr);
  };
  if (!existsSync(join(cwd, ".git"))) {
    git(["clone", "--shared", "--no-checkout", "--quiet", source, cwd], root);
    git(["checkout", "-B", "codex/ent-gate-null-promotion-bootstrap", "9882c8b5044d238c398dde8e0ec45b7bf039cc89"]);
  }
  if (ambientMode) writeFileSync(join(cwd, "slice-gates.yaml"), `slice: NC-X\nbranch: codex/x\npromotion-mode: ${ambientMode}\n`);
  const checker = new URL("../check.mjs", import.meta.url).href;
  const code = `import { run } from ${JSON.stringify(checker)}; console.log(JSON.stringify(run(JSON.parse(process.argv[1]), JSON.parse(process.argv[2]))));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", code, JSON.stringify(args), JSON.stringify(env)], { cwd, env: cleanGitEnv(), encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

export function rootRepairFixture(test) {
  const dir = mkdtempSync(join(tmpdir(), "nc-root-context-")), cwd = join(dir, "repo");
  const source = fileURLToPath(new URL("../../../", import.meta.url));
  const inheritedGit = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toUpperCase().startsWith("GIT_")));
  for (const key of Object.keys(inheritedGit)) delete process.env[key];
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
  } finally {
    for (const key of Object.keys(process.env)) if (key.toUpperCase().startsWith("GIT_")) delete process.env[key];
    Object.assign(process.env, inheritedGit);
    rmSync(dir, { recursive: true, force: true });
  }
}
