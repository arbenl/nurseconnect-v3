import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const sonarWorkflow = readFileSync(".github/workflows/sonar.yml", "utf8");
const multiAgentWorkflow = readFileSync(".github/workflows/multi-agent-pr-hardening.yml", "utf8");
const sonarGateScript = readFileSync("scripts/sonar-gate.sh", "utf8");

function extractJob(name) {
  const match = ciWorkflow.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-zA-Z0-9_-]+:\\n|\\n?$)`));
  return match?.[1] ?? "";
}

describe("Sonar workflow parity", () => {
  it("runs a blocking Sonar quality gate inside CI for pull requests", () => {
    const coverageJob = extractJob("sonar-coverage");
    const sonarJob = extractJob("sonar-quality-gate");

    expect(coverageJob).toContain("name: Sonar Coverage");
    expect(coverageJob).toContain("pnpm test:coverage");
    expect(coverageJob).not.toContain("SONAR_TOKEN");
    expect(sonarJob).toContain("name: Sonar Quality Gate");
    expect(sonarJob).toContain("if: always() && github.event_name == 'pull_request'");
    expect(sonarJob).toContain("needs: [quality, sonar-coverage]");
    expect(sonarJob).toContain("needs['sonar-coverage'].result");
    expect(sonarJob).not.toContain("needs.sonar-coverage.result");
    expect(sonarJob).toContain("uses: SonarSource/sonarqube-scan-action@v6");
    expect(sonarJob).toContain("-Dsonar.qualitygate.wait=true");
    expect(sonarJob).toContain("- enforcement: enforce");
    expect(sonarJob).toContain('if [[ "$qg_status" != "OK" ]]');
    expect(sonarJob).not.toContain("sonar-scan.log");
    expect(sonarJob).not.toContain("pnpm");
    expect(sonarJob).not.toContain("GITHUB_TOKEN");
    expect(sonarJob).not.toContain("pull-requests: write");
    expect(ciWorkflow).not.toContain("SONAR_ENFORCEMENT: warn");
  });

  it("makes PR Finalizer depend on and require the Sonar quality gate", () => {
    expect(ciWorkflow).toContain("if: always() && github.event_name == 'pull_request'");
    expect(ciWorkflow).toContain(
      "needs: [quality, sonar-quality-gate, unit, db-integration, e2e-api, e2e-ui-smoke]",
    );
    expect(ciWorkflow).toMatch(/PR_FINALIZER_REQUIRED_CHECKS:[\s\S]*Sonar Quality Gate/);
  });

  it("publishes the PR summary in a separate no-checkout job", () => {
    const summaryJob = extractJob("sonar-pr-summary");

    expect(summaryJob).toContain("name: Sonar PR Summary");
    expect(summaryJob).toContain("pull-requests: write");
    expect(summaryJob).toContain("actions/download-artifact@v4");
    expect(summaryJob).toContain("path: ${{ env.EVIDENCE_DIR }}");
    expect(summaryJob).not.toContain("path: ${{ github.workspace }}");
    expect(summaryJob).not.toContain("actions/checkout");
    expect(summaryJob).not.toContain("SONAR_TOKEN");
    expect(summaryJob).not.toContain("pnpm");
  });

  it("keeps the baseline workflow advisory and out of pull request enforcement", () => {
    expect(sonarWorkflow).toContain("name: Sonar Baseline");
    expect(sonarWorkflow).not.toMatch(/\n\s+pull_request:/);
    expect(sonarWorkflow).toContain("SONAR_ENFORCEMENT: warn");
    expect(sonarWorkflow).not.toContain("SONAR_ENFORCEMENT: enforce");
    expect(sonarWorkflow).not.toContain("SONAR_QUALITYGATE_WAIT");
    expect(sonarGateScript).toContain("fetch_quality_gate");
    expect(sonarGateScript).toContain("publish_step_summary");
    expect(sonarGateScript).toContain("- quality_gate: ${qg_status}");
    expect(sonarGateScript).toContain("- dashboard: ${DASHBOARD_URL}");
  });

  it("fails warn mode when no fresh Sonar analysis is uploaded", () => {
    const root = process.cwd();
    const temp = mkdtempSync(join(tmpdir(), "sonar-gate-"));
    const bin = join(temp, "bin");
    const pnpm = join(bin, "pnpm");
    const evidence = join(temp, "evidence");
    const stepSummary = join(temp, "step-summary.md");

    mkdirSync(bin, { recursive: true });
    writeFileSync(
      pnpm,
      "#!/usr/bin/env bash\nif [[ \"$1\" == \"sonar:scan\" ]]; then echo scan failed; exit 42; fi\nexit 99\n",
    );
    chmodSync(pnpm, 0o755);

    let status = 0;
    try {
      execFileSync("bash", ["scripts/sonar-gate.sh"], {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          SONAR_TOKEN: "token",
          SONAR_HOST_URL: "https://sonar.example.test",
          SONAR_PROJECT_KEY: "nurseconnect-test",
          SONAR_ENFORCEMENT: "warn",
          SONAR_RUN_COVERAGE: "false",
          EVIDENCE_DIR: evidence,
          GITHUB_STEP_SUMMARY: stepSummary,
        },
        stdio: "pipe",
      });
    } catch (error) {
      status = error.status;
    }

    const summary = readFileSync(join(evidence, "notes", "sonar-summary.md"), "utf8");
    expect(status).toBe(42);
    expect(summary).toContain("- scan_status: FAIL (42)");
    expect(summary).toContain("- quality_gate: NOT_QUERIED_AFTER_SCAN_FAILURE");
    expect(existsSync(join(evidence, "logs", "sonar-qualitygate.json"))).toBe(false);
    expect(readFileSync(stepSummary, "utf8")).toContain("## Sonar Baseline");
  });

  it("keeps multi-agent PR hardening wired to Sonar, Sentinel, and Sentry evidence", () => {
    expect(multiAgentWorkflow).toContain("name: Multi-Agent PR Hardening");
    expect(multiAgentWorkflow).toContain("pnpm multiagent:pr-hardening");
    expect(multiAgentWorkflow).toContain("SONAR_TOKEN");
    expect(multiAgentWorkflow).toContain("SENTRY_AUTH_TOKEN");
    expect(multiAgentWorkflow).toContain("tmp/multi-agent/run-*/evidence/");
  });
});
