import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { cleanGitEnv } from "./evidence.mjs";
import { REPAIR_BASE, REPAIR_FILES } from "./root-repair-policy.mjs";
export function rootRepairContext(env, cwd = ".") {
  const errors = [];
  const git = (args) => {
    const result = spawnSync("git", args, { cwd, env: cleanGitEnv(), encoding: "utf8" });
    if (result.status !== 0) throw new Error("Root repair Git identity is unavailable.");
    return result.stdout.trim();
  };
  let mainSha = "";
  try {
    mainSha = git(["rev-parse", "--verify", "origin/main^{commit}"]);
    for (const file of REPAIR_FILES) {
      const stat = lstatSync(`${cwd}/${file}`);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o111)) errors.push(`Root repair file mode is forbidden: ${file}`);
      const existedAtBase = Boolean(git(["ls-tree", REPAIR_BASE, "--", file]));
      for (const ref of [REPAIR_BASE, "HEAD"]) {
        const tree = git(["ls-tree", ref, "--", file]);
        if ((existedAtBase && !tree) || (tree && !tree.startsWith("100644 blob "))) errors.push(`Root repair changes a protected tree mode: ${file}`);
      }
      const index = git(["ls-files", "--stage", "--", file]);
      if ((existedAtBase && !index) || (index && !/^100644 [a-f0-9]{40} 0\t[^\n]+$/.test(index))) errors.push(`Root repair index mode is forbidden: ${file}`);
    }
    if (env.GITHUB_ACTIONS === "true" || env.GITHUB_EVENT_NAME === "pull_request") {
      if (env.GITHUB_EVENT_NAME !== "pull_request") errors.push("Root repair event must be pull_request.");
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
      const pr = event.pull_request;
      if (env.GITHUB_REPOSITORY !== "arbenl/nurseconnect-v3" || pr?.base?.repo?.full_name !== "arbenl/nurseconnect-v3"
        || pr?.head?.repo?.full_name !== "arbenl/nurseconnect-v3" || pr?.base?.sha !== REPAIR_BASE
        || pr?.base?.ref !== "main" || !/^[a-f0-9]{40}$/.test(pr?.head?.sha || "")) errors.push("Root repair PR identity is invalid.");
      const head = git(["rev-parse", "HEAD"]);
      if (head !== pr?.head?.sha) {
        const parents = git(["rev-list", "--parents", "-n", "1", "HEAD"]).split(" ").slice(1);
        if (parents.length !== 2 || parents[0] !== REPAIR_BASE || parents[1] !== pr?.head?.sha) errors.push("Root repair checkout is not the event head or expected merge.");
      }
    }
  } catch { errors.push("Root repair identity or regular-file evidence is unavailable."); }
  return { mainSha, errors };
}
export function loadRepairRecord() {
  const path = "config/nc-governance-fixture-repair.json";
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error("Root repair record must be regular.");
  return JSON.parse(readFileSync(path, "utf8"));
}
