import { existsSync } from "node:fs";
import path from "node:path";

import { fail, pass, readJson, validMustFixDisposition } from "./slice-evidence-shared.mjs";

export async function checkCodexSeniorReview(runRoot, options) {
  const file = path.join(runRoot, "reviews", "codex-senior-review.json");
  if (!existsSync(file)) {
    return options.requireCodexSeniorReview
      ? fail("codex senior review receipt is missing", { path: file })
      : pass("codex senior review not required", { path: file });
  }

  const evidence = await readJson(file);
  if (!options.requireCodexSeniorReview) {
    return pass("codex senior review recorded but not required", {
      path: file,
      evidenceStatus: evidence.status || "unknown",
    });
  }
  const receiptPath = evidence.receiptPath
    ? path.resolve(runRoot, evidence.receiptPath)
    : path.join(runRoot, "reviews", "codex-senior-review.md");
  const mustFixCount = Number.isFinite(Number(evidence.mustFixCount)) ? Number(evidence.mustFixCount) : 0;
  const missing = [];
  const blockedAllowed = evidence.status === "blocked" && options.allowCodexSeniorBlocked && evidence.blocker;
  if (evidence.status !== "pass" && !blockedAllowed) missing.push(`status:${evidence.status || "missing"}`);
  if (evidence.reviewer !== "codex-senior") missing.push("reviewer:codex-senior");
  if (!evidence.baseSha) missing.push("baseSha");
  if (!evidence.headSha) missing.push("headSha");
  if (!Array.isArray(evidence.changedFiles)) missing.push("changedFiles");
  if (!existsSync(receiptPath)) missing.push("receiptPath");
  if (mustFixCount > 0 && !validMustFixDisposition(options.codexMustFixDisposition, mustFixCount)) {
    missing.push("codexMustFixDisposition");
  }

  if (missing.length > 0) {
    return fail("codex senior review receipt did not pass", {
      path: file,
      missing,
      mustFixCount,
      codexMustFixDisposition: options.codexMustFixDisposition || "",
    });
  }

  return pass("codex senior review receipt passed", {
    path: file,
    receiptPath,
    evidenceStatus: evidence.status,
    blocker: evidence.blocker || null,
    baseSha: evidence.baseSha,
    headSha: evidence.headSha,
    changedFileCount: evidence.changedFiles.length,
    mustFixCount,
    codexMustFixDisposition: options.codexMustFixDisposition || evidence.mustFixDisposition || "none",
  });
}
