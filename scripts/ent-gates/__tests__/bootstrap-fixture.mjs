import { existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanGitEnv } from "../evidence.mjs";

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
