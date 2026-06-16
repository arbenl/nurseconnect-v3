import { rmSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { verifyReferencedRunRoot } from "../check-pr-slice-evidence.mjs";
import { goodEvidence, makeRunRoot, requiredReviewers, writeRunRoot } from "./pr-slice-evidence-helpers.mjs";

describe("PR slice evidence run-root verifier", () => {
  it("verifies cited run-root artifacts when available locally", () => {
    const root = makeRunRoot();
    try {
      writeRunRoot(root);
      const body = goodEvidence.replaceAll("tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee", root);
      const result = verifyReferencedRunRoot({ body, files: ["apps/web/src/app/api/admin/users/route.ts"] });
      expect(result.status).toBe("pass");
      expect(result.command).toContain("--require-reviewers sonnet46,gemini");
      expect(result.command).toContain("--require-subagent-results");
      expect(result.command).not.toContain("--allow-dry-run");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails cited run-root verification when high-risk evidence is dry-run only", () => {
    const root = makeRunRoot();
    try {
      writeRunRoot(root, { status: "dry-run", completed: [], dryRun: requiredReviewers });
      const body = goodEvidence.replaceAll("tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee", root);
      const result = verifyReferencedRunRoot({ body, files: ["apps/web/src/app/api/admin/users/route.ts"] });
      expect(result.status).toBe("fail");
      expect(result.errors.join("\n")).toContain("required model-review receipts are missing");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not require strict reviewer receipts when model access evidence is blocked", () => {
    const root = makeRunRoot();
    try {
      writeRunRoot(root, {
        status: "not-run",
        completed: [],
        dryRun: [],
        blocked: [],
        debate: false,
        access: { status: "blocked", reviewers: requiredReviewers, completed: [], blocked: requiredReviewers.map((reviewer) => ({ reviewer })) },
      });
      const body = goodEvidence
        .replaceAll("tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee", root)
        .replace(/- \[x\] Subagent results:[^\n]+\n/, "")
        .replace(/- \[x\] Model debate:[^\n]+\n/, "- [x] Model debate skipped: model access blocked; external reviewers were not counted as approval.\n")
        .replace(/- \[x\] `pnpm slice:evidence -- --run-root <run-root> --require-reviewers[^\n]+\n/, "");
      const result = verifyReferencedRunRoot({ body, files: ["scripts/multi-agent/model-review.mjs"] });
      expect(result.status).toBe("pass");
      expect(result.command).not.toContain("--require-reviewers");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("still verifies strict receipts when only optional model access is blocked", () => {
    const root = makeRunRoot();
    try {
      writeRunRoot(root, {
        access: { status: "blocked", reviewers: [...requiredReviewers, "claude48"], completed: requiredReviewers, blocked: [{ reviewer: "claude48" }] },
      });
      const body = goodEvidence.replaceAll("tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee", root);
      const result = verifyReferencedRunRoot({ body, files: ["scripts/multi-agent/model-review.mjs"] });
      expect(result.status).toBe("pass");
      expect(result.command).toContain("--require-reviewers");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("can skip missing local run roots for clean CI checkouts", () => {
    const missing = "tmp/multi-agent/verify-slice/missing-ci-run-root";
    const body = goodEvidence.replaceAll("tmp/multi-agent/verify-slice/verify-slice-20260605T080944Z-fe7eee", missing);
    const strict = verifyReferencedRunRoot({ body, files: ["scripts/multi-agent/verify-slice.sh"] });
    const ci = verifyReferencedRunRoot({ body, files: ["scripts/multi-agent/verify-slice.sh"], allowMissing: true });
    expect(strict.status).toBe("fail");
    expect(ci.status).toBe("pass");
    expect(ci.skipped).toBe(true);
  });
});
