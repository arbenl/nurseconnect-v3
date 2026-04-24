import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const ciWorkflow = readFileSync(".github/workflows/ci.yml", "utf8");
const sonarWorkflow = readFileSync(".github/workflows/sonar.yml", "utf8");

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
    expect(summaryJob).toContain("path: ${{ github.workspace }}");
    expect(summaryJob).not.toContain("path: ${{ env.EVIDENCE_DIR }}");
    expect(summaryJob).not.toContain("actions/checkout");
    expect(summaryJob).not.toContain("SONAR_TOKEN");
    expect(summaryJob).not.toContain("pnpm");
  });

  it("keeps the baseline workflow out of pull request enforcement", () => {
    expect(sonarWorkflow).toContain("name: Sonar Baseline");
    expect(sonarWorkflow).not.toMatch(/\n\s+pull_request:/);
    expect(sonarWorkflow).toContain("SONAR_ENFORCEMENT: enforce");
    expect(sonarWorkflow).not.toContain("SONAR_ENFORCEMENT: warn");
  });
});
