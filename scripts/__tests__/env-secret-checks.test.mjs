import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AUTH_SECRET_PLACEHOLDER_TERMS } from "../env-check.mjs";

const baseEnv = {
  NC_ENV_CHECK_SKIP_LOCAL_FILES: "1",
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://nurseconnect:password@db.example.test:5432/nurseconnect",
  BETTER_AUTH_SECRET: "ProdSecretAlphaBetaGammaDelta12345!",
  APP_URL: "https://app.example.test",
  BETTER_AUTH_URL: "https://app.example.test",
  NC_EMAIL_VERIFICATION_MODE: "observe",
  EMAIL_PROVIDER: "postmark",
  EMAIL_FROM: "ops@example.test",
  POSTMARK_SERVER_TOKEN: "postmark-test-token",
};

function runEnvCheck(overrides = {}) {
  const env = { ...process.env, ...baseEnv };
  for (const key of Object.keys(env)) {
    if (
      key === "NEXT_PUBLIC_USE_EMULATORS" ||
      key.startsWith("FIREBASE_") ||
      key.startsWith("NEXT_PUBLIC_FIREBASE_")
    ) {
      delete env[key];
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  try {
    const stdout = execFileSync("node", ["scripts/env-check.mjs"], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return { status: 0, stdout, stderr: "" };
  } catch (error) {
    return {
      status: error.status,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

describe("env secret checks", () => {
  it("passes with valid production posture", () => {
    expect(runEnvCheck().status).toBe(0);
  });

  it("does not run production-only checks when NODE_ENV is unset", () => {
    const result = runEnvCheck({
      NODE_ENV: undefined,
      BETTER_AUTH_SECRET: "dev-secret-do-not-use-in-prod",
      NC_EMAIL_VERIFICATION_MODE: "off",
      EMAIL_PROVIDER: "disabled",
      EMAIL_FROM: "",
      POSTMARK_SERVER_TOKEN: "",
      APP_URL: "http://localhost:3010",
      BETTER_AUTH_URL: "http://localhost:3010",
    });

    expect(result.status).toBe(0);
  });

  it("rejects short production auth secrets without echoing the secret", () => {
    const weakSecret = "short-secret";
    const result = runEnvCheck({ BETTER_AUTH_SECRET: weakSecret });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("BETTER_AUTH_SECRET must be at least 32 characters");
    expect(`${result.stdout}${result.stderr}`).not.toContain(weakSecret);
  });

  it.each(AUTH_SECRET_PLACEHOLDER_TERMS)(
    "rejects production auth secrets containing placeholder term %s",
    (term) => {
      const weakSecret = `ProdValue-${term}-AlphaBetaGammaDelta12345!`;
      const result = runEnvCheck({ BETTER_AUTH_SECRET: weakSecret });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("BETTER_AUTH_SECRET cannot use a local placeholder value");
      expect(`${result.stdout}${result.stderr}`).not.toContain(weakSecret);
    }
  );
});

describe("secret scanning workflow", () => {
  const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");

  it("keeps Gitleaks fail-closed before install and build in CI", () => {
    const secretScanIndex = ciWorkflow.indexOf("- name: Secret Scan (Gitleaks)");
    const installIndex = ciWorkflow.indexOf("- name: Install dependencies");
    const buildIndex = ciWorkflow.indexOf("- name: Build Web Application");
    const step = ciWorkflow.slice(secretScanIndex, ciWorkflow.indexOf("\n      - name:", secretScanIndex + 1));

    expect(secretScanIndex).toBeGreaterThan(-1);
    expect(step).toContain("uses: gitleaks/gitleaks-action@v2");
    expect(step).not.toContain("continue-on-error");
    expect(secretScanIndex).toBeLessThan(installIndex);
    expect(secretScanIndex).toBeLessThan(buildIndex);
    expect(ciWorkflow).toContain("run: pnpm env:check");
  });
});
