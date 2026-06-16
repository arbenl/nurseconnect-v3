import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export function validateEntGateEvidence(errors, evidence, manifestPath = "slice-gates.yaml", files = []) {
  const text = String(evidence || "");
  if (!/\bent-gates\s*:\s*PASS\b/i.test(text)) errors.push("Evidence section missing ent-gates PASS.");
  if (!/evidence\/ent-gates\.(md|json)/i.test(text)) errors.push("Evidence section missing ent-gates evidence path.");

  const cited = text.match(/\bmanifest\s+sha(?:256)?\s*:\s*`?([a-f0-9]{64})`?/i)?.[1];
  if (!cited) return errors.push("Evidence section missing slice-gates manifest sha256.");
  if (!existsSync(manifestPath)) return errors.push(`Unable to read gate manifest for sha validation: ${manifestPath}`);

  const actual = createHash("sha256").update(readFileSync(manifestPath)).digest("hex");
  if (cited !== actual) errors.push(`slice-gates manifest sha mismatch: cited ${cited}, actual ${actual}.`);
  const args = [
    "scripts/ent-gates/check.mjs",
    "--run-root",
    "tmp/multi-agent/pr-finalizer-ent-gates",
  ];
  if (process.env.BASE_COMMIT) args.push("--base", process.env.BASE_COMMIT);
  else if (files.length > 0) args.push("--base", "HEAD", "--enforce-promotion", "false");
  if (process.env.PR_FILES_COMPLETE === "1" || (files.length > 0 && !process.env.BASE_COMMIT)) args.push("--changed-files-complete");
  for (const file of files) args.push("--changed-file", file);
  const check = spawnSync("node", args, { encoding: "utf8" });
  if (check.status !== 0) errors.push(`ent-gates checkout verification failed:\n${check.stdout || ""}${check.stderr || ""}`.trim());
}
