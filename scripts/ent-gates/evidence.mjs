import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function manifestSha(file = "slice-gates.yaml") {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

export function writeEvidence({ runRoot, manifest, sha, changedFiles, hits, errors }) {
  const dir = join(runRoot, "evidence");
  mkdirSync(dir, { recursive: true });
  const verdict = errors.length === 0 ? "PASS" : "FAIL";
  const payload = { status: verdict.toLowerCase(), manifest, manifestSha: sha, changedFiles, hits, errors };
  writeFileSync(join(dir, "ent-gates.json"), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(join(dir, "ent-gates.md"), markdown({ verdict, sha, manifest, hits, errors }));
}

function markdown({ verdict, sha, manifest, hits, errors }) {
  const lines = [
    "# Enterprise Gates Evidence",
    "",
    `- ent-gates: ${verdict}`,
    `- slice: ${manifest?.slice || "unknown"}`,
    `- branch: ${manifest?.branch || "unknown"}`,
    `- manifest sha256: ${sha}`,
    "",
    "## Declarations",
  ];
  for (const [gate, value] of Object.entries(manifest?.gates || {})) lines.push(`- ${gate}: ${value.status}`);
  lines.push("", "## Guarded Path Hits");
  for (const [gate, files] of Object.entries(hits || {})) lines.push(`- ${gate}: ${files.length ? files.join(", ") : "none"}`);
  if (errors.length) lines.push("", "## Errors", ...errors.map((error) => `- ${error}`));
  return `${lines.join("\n")}\n`;
}
