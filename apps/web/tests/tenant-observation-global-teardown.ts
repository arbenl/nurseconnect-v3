import { readFileSync, writeFileSync } from "node:fs";

import { parseTenantObservationEvidence } from "../src/lib/tenant-observation-evidence";

export default function tenantObservationGlobalTeardown() {
  const runId = process.env.TENANT_SCOPE_OBSERVATION_RUN;
  const evidencePath = process.env.TENANT_SCOPE_VIOLATION_FILE;
  const summaryPath = process.env.TENANT_SCOPE_OBSERVATION_SUMMARY;
  if (!runId || !evidencePath || !summaryPath) {
    throw new Error("Tenant observation harness configuration is missing");
  }

  let evidence;
  try {
    evidence = parseTenantObservationEvidence(readFileSync(evidencePath, "utf8"), runId, {
      allowInactiveObserver: process.env.TENANT_SCOPE_REQUIRE_LIVENESS === "0",
      requireTrackedQuery: process.env.TENANT_SCOPE_REQUIRE_LIVENESS !== "0",
    });
  } catch {
    try {
      writeFileSync(summaryPath, `${JSON.stringify({ run: runId, status: "FAIL" }, null, 2)}\n`, "utf8");
    } catch {}
    throw new Error("Tenant observation evidence failed closed");
  }

  const summary = {
    run: runId,
    status: evidence.violationCount === 0 ? "PASS" : "FAIL",
    ...evidence,
  };
  try {
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  } catch {
    throw new Error("Tenant observation summary could not be retained");
  }
  console.info(`[tenant-observation] tenant_scope_violations=${evidence.violationCount}`);
  if (evidence.violationCount !== 0) {
    throw new Error(`Tenant scope violation count is nonzero: ${evidence.violationCount}`);
  }
}
