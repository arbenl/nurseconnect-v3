import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { cleanGitEnv } from "./evidence.mjs";
import { REPAIR_BASE, REPAIR_FILES } from "./root-repair-policy.mjs";
export function rootRepairContext(env, cwd = ".") {
  const errors = [];
  const git = (args) => {
    const result = spawnSync("git", ["--no-replace-objects", ...args], { cwd, env: cleanGitEnv(), encoding: "utf8" });
    if (result.status !== 0) throw new Error("Root repair Git identity is unavailable.");
    return result.stdout.trim();
  };
  const records = (output) => {
    const entries = new Map();
    for (const row of output.split("\0").filter(Boolean)) {
      const split = row.indexOf("\t"), file = row.slice(split + 1);
      if (split < 0 || !REPAIR_FILES.includes(file)) throw new Error("Root repair Git inventory is invalid.");
      entries.set(file, [...(entries.get(file) || []), row.slice(0, split)]);
    }
    return entries;
  };
  let mainSha = "";
  try {
    mainSha = git(["rev-parse", "--verify", "origin/main^{commit}"]);
    if (git(["for-each-ref", "--format=%(refname)", "refs/replace/"])) errors.push("Root repair forbids replace refs.");
    for (const file of REPAIR_FILES) {
      const stat = lstatSync(`${cwd}/${file}`);
      if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o111)) {
        errors.push(`Root repair file mode is forbidden: ${file}`);
        return { mainSha, errors };
      }
    }
    const base = records(git(["ls-tree", "-z", REPAIR_BASE, "--", ...REPAIR_FILES]));
    const headTree = records(git(["ls-tree", "-z", "HEAD", "--", ...REPAIR_FILES]));
    const indexTree = records(git(["ls-files", "--stage", "-z", "--", ...REPAIR_FILES]));
    for (const file of REPAIR_FILES) {
      const existedAtBase = base.has(file);
      for (const tree of [base.get(file) || [], headTree.get(file) || []]) {
        if ((existedAtBase && !tree.length) || (tree.length && (tree.length !== 1 || !tree[0].startsWith("100644 blob ")))) errors.push(`Root repair changes a protected tree mode: ${file}`);
      }
      const index = indexTree.get(file) || [];
      if ((existedAtBase && !index.length) || (index.length && (index.length !== 1 || !/^100644 [a-f0-9]{40} 0$/.test(index[0])))) errors.push(`Root repair index mode is forbidden: ${file}`);
    }
    if (env.GITHUB_ACTIONS === "true" || env.GITHUB_EVENT_NAME === "pull_request") {
      if (env.GITHUB_EVENT_NAME !== "pull_request") errors.push("Root repair event must be pull_request.");
      const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
      const pr = event.pull_request;
      if (env.GITHUB_REPOSITORY !== "arbenl/nurseconnect-v3" || pr?.base?.repo?.full_name !== "arbenl/nurseconnect-v3"
        || pr?.head?.repo?.full_name !== "arbenl/nurseconnect-v3" || pr?.base?.sha !== REPAIR_BASE
        || pr?.base?.ref !== "main" || !/^[a-f0-9]{40}$/.test(pr?.head?.sha || "")) errors.push("Root repair PR identity is invalid.");
      const head = git(["rev-parse", "--verify", "HEAD^{commit}"]);
      if (git(["cat-file", "-t", pr?.head?.sha || ""]) !== "commit") errors.push("Root repair event head must exist as a commit.");
      if (head !== pr?.head?.sha) {
        const parents = git(["cat-file", "-p", head]).split(/\r?\n\r?\n/, 1)[0].split(/\r?\n/).filter((line) => line.startsWith("parent ")).map((line) => line.slice(7));
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
