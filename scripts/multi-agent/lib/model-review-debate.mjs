import { writeFileSync } from "node:fs";
import path from "node:path";

function findingLines(text, label) {
  const findings = [];
  let active = "";
  for (const line of String(text || "").split("\n")) {
    const trimmed = line.trim();
    const section = trimmed.match(/^(?:#{1,6}\s*)?(?:\*\*)?`?(MUST_FIX|SHOULD_FIX|NICE_TO_HAVE|HARDENING|OPTIONAL)`?(?:\*\*)?\s*$/i);
    if (section) {
      active = section[1].toUpperCase();
      continue;
    }
    if (/^#{1,6}\s+/.test(trimmed)) active = "";
    const inline = trimmed.match(/^(?:(?:[-*]|\d+[.)])\s*)?(?:\*\*)?`?(MUST_FIX|SHOULD_FIX|NICE_TO_HAVE|HARDENING|OPTIONAL)`?(?:\*\*)?\s*[:|-]\s*(.+)$/i);
    const sectionText = trimmed.replace(/^(?:[-*]|\d+[.)])\s+/, "");
    const finding = inline ? `${inline[1].toUpperCase()}: ${inline[2]}` : active && sectionText ? `${active}: ${sectionText}` : "";
    if (finding && !/:\s*(none|n\/a|no findings)\b/i.test(finding)) findings.push(`${label}: ${finding}`);
  }
  return findings.slice(0, 20);
}

function blockedSummary(result) {
  return {
    reviewer: result.reviewer,
    stdout: result.stdout.slice(0, 500),
    stderr: result.stderr.slice(0, 500),
    blocker: (result.stderr || result.stdout).slice(0, 500),
  };
}

export function writeDebate(reviewDir, results) {
  const completed = results.filter((result) => result.status === "complete");
  const dryRun = results.filter((result) => result.status === "dry-run");
  const blocked = results.filter((result) => result.status === "blocked");
  const findings = results.flatMap((result) => findingLines(result.stdout, result.reviewer));
  const mustFix = findings.filter((line) => /MUST_FIX/i.test(line));
  const otherFindings = findings.filter((line) => !/MUST_FIX/i.test(line));
  const verdict = mustFix.length > 0 ? "NOT READY UNTIL MUST_FIX DISPOSITION" : "READY IF DETERMINISTIC GATES PASS";
  const debate = {
    generatedAt: new Date().toISOString(),
    participants: results.map(({ reviewer, status, provider, model, role, exitCode }) => ({
      reviewer,
      status,
      provider,
      model,
      role,
      exitCode,
    })),
    completed: completed.map((result) => result.reviewer),
    dryRun: dryRun.map((result) => result.reviewer),
    blocked: blocked.map(blockedSummary),
    agreedMustFixCandidates: mustFix,
    otherFindingCandidates: otherFindings,
    disputedOrMissingEvidence: blocked.map((result) => `${result.reviewer} unavailable; treat as missing advisory signal, not approval.`),
    verdict,
  };
  writeFileSync(path.join(reviewDir, "debate.json"), `${JSON.stringify(debate, null, 2)}\n`);
  writeFileSync(path.join(reviewDir, "debate.md"), markdown(debate, mustFix, otherFindings));
}

function markdown(debate, mustFix, otherFindings) {
  return [
    "# Model Critique Debate",
    "",
    `- verdict: \`${debate.verdict}\``,
    `- completed: \`${debate.completed.join(", ") || "none"}\``,
    `- dry_run: \`${debate.dryRun.join(", ") || "none"}\``,
    `- blocked: \`${debate.blocked.map((item) => item.reviewer).join(", ") || "none"}\``,
    "",
    "## Agreed MUST_FIX Candidates",
    ...(mustFix.length > 0 ? mustFix.map((item) => `- ${item}`) : ["- None detected in reviewer output."]),
    "",
    "## Other Finding Candidates",
    ...(otherFindings.length > 0 ? otherFindings.map((item) => `- ${item}`) : ["- None detected in reviewer output."]),
    "",
    "## Missing Or Disputed Evidence",
    ...(debate.disputedOrMissingEvidence.length > 0 ? debate.disputedOrMissingEvidence.map((item) => `- ${item}`) : ["- None."]),
  ].join("\n");
}
