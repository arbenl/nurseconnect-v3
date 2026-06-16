import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { auditBranchProtection } from "../check-branch-protection.mjs";

const expectedConfig = JSON.parse(readFileSync(".github/branch-protection.json", "utf8"));
const script = "scripts/check-branch-protection.mjs";

function observed(overrides = {}) {
  const payload = expectedConfig.payload;
  return {
    required_status_checks: {
      strict: payload.required_status_checks.strict,
      contexts: [...payload.required_status_checks.contexts],
    },
    enforce_admins: { enabled: payload.enforce_admins },
    required_pull_request_reviews: { ...payload.required_pull_request_reviews },
    required_conversation_resolution: { enabled: payload.required_conversation_resolution },
    allow_force_pushes: { enabled: payload.allow_force_pushes },
    allow_deletions: { enabled: payload.allow_deletions },
    ...overrides,
  };
}

describe("branch protection audit", () => {
  it("passes when live protection matches the checked-in NurseConnect requirements", () => {
    const result = auditBranchProtection({ expectedConfig, observedProtection: observed() });

    expect(result.status).toBe("pass");
    expect(result.errors).toEqual([]);
  });

  it("fails when required checks or hard blockers are missing", () => {
    const result = auditBranchProtection({
      expectedConfig,
      observedProtection: observed({
        required_status_checks: {
          strict: false,
          contexts: ["Type Check & Lint"],
        },
        enforce_admins: { enabled: false },
        required_conversation_resolution: { enabled: false },
        allow_force_pushes: { enabled: true },
      }),
    });

    expect(result.status).toBe("fail");
    expect(result.errors).toContain("required_status_checks.strict must be true");
    expect(result.errors).toContain("missing required status check: PR Finalizer");
    expect(result.errors).toContain("enforce_admins must be true");
    expect(result.errors).toContain("required_conversation_resolution is not enforced");
    expect(result.errors).toContain("allow_force_pushes must be false");
  });

  it("accepts GitHub check objects as status-check evidence", () => {
    const contexts = expectedConfig.payload.required_status_checks.contexts.map((context) => ({ context }));
    const result = auditBranchProtection({
      expectedConfig,
      observedProtection: observed({ required_status_checks: { strict: true, checks: contexts } }),
    });

    expect(result.status).toBe("pass");
  });

  it("rejects fixture response overrides outside test mode", () => {
    const result = spawnSync("node", [script, "--owner", "x", "--repo", "y"], {
      encoding: "utf8",
      env: { ...process.env, NODE_ENV: "production", BRANCH_PROTECTION_AUDIT_RESPONSE: "{}" },
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("only allowed in test mode");
  });

  it("allows explicit CI downgrade for inaccessible branch-protection API", () => {
    const root = mkdtempSync(join(tmpdir(), "branch-protection-audit-"));
    try {
      const gh = join(root, "gh");
      writeFileSync(gh, "#!/usr/bin/env bash\necho '{\"message\":\"Resource not accessible by integration\"}'\nexit 1\n");
      chmodSync(gh, 0o755);
      const result = spawnSync("node", [script, "--owner", "x", "--repo", "y", "--allow-inaccessible"], {
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: "production", PATH: `${root}:${process.env.PATH}` },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toContain("Resource not accessible by integration");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
