import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  evaluateTenantIsolation,
  exitCodeFor,
  EXIT_FAIL,
  EXIT_OK,
  EXIT_SKIPPED,
  STATUS_FAIL,
  STATUS_PASS,
  STATUS_PENDING_SCHEMA,
} from "../tenant-isolation-abuse.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const scriptPath = join(repoRoot, "scripts/tenant-isolation-abuse.mjs");
const contract = JSON.parse(readFileSync(join(repoRoot, "config/tenant-isolation-contract.json"), "utf8"));

function tableInventory(overrides = {}) {
  const tables = {};
  for (const expected of contract.expectedTenantBoundaryTables ?? []) {
    tables[expected.table] = {
      columns: [],
      rlsEnabled: false,
      ...overrides[expected.table],
    };
  }
  for (const expected of contract.expectedTenantOwnedTables) {
    tables[expected.table] = {
      columns: [expected.requiredTenantColumn, ...(expected.requiredResourceColumns ?? [])],
      rlsEnabled: true,
      ...overrides[expected.table],
    };
  }
  return { source: "test", tables };
}

function contractWithScenarioAssertions() {
  return {
    ...contract,
    requiredIsolationScenarios: contract.requiredIsolationScenarios.map((scenario) => ({
      ...scenario,
      assertionRefs:
        scenario.assertionRefs.length > 0
          ? scenario.assertionRefs
          : [`scripts/__tests__/tenant-isolation-abuse.test.mjs#${scenario.id}`],
    })),
  };
}

describe("tenant isolation abuse harness", () => {
  it("fails when the tenant boundary table expected by the contract is missing", () => {
    const evaluation = evaluateTenantIsolation(contract, { source: "test", tables: {} });

    expect(evaluation.status).toBe(STATUS_FAIL);
    expect(evaluation.missingBoundaryTables).toContain("organizations");
  });

  it("reports partial tenant-owned metadata as advisory pending schema, not pass", () => {
    const evaluation = evaluateTenantIsolation(contract, {
      source: "test",
      tables: {
        organizations: {
          columns: [],
          rlsEnabled: false,
        },
        org_memberships: {
          columns: ["organization_id"],
          rlsEnabled: true,
        },
      },
    });

    expect(evaluation.status).toBe(STATUS_PENDING_SCHEMA);
    expect(evaluation.summary.readyBoundaryTables).toBe(contract.expectedTenantBoundaryTables.length);
    expect(evaluation.summary.readyTables).toBe(1);
    expect(evaluation.tableResults.find((result) => result.table === "org_memberships")?.ready).toBe(true);
    expect(evaluation.missingScenarios).toContain("tenant_a_cannot_read_tenant_b");
  });

  it("fails once a tenant-owned table has tenant ownership without RLS", () => {
    const evaluation = evaluateTenantIsolation(contract, tableInventory({
      service_requests: {
        columns: ["organization_id", "facility_id"],
        rlsEnabled: false,
      },
    }));

    expect(evaluation.status).toBe(STATUS_FAIL);
    expect(evaluation.tableResults.find((result) => result.table === "service_requests")?.missingRls).toBe(true);
  });

  it("does not fail just because a table has non-tenant RLS before tenant columns exist", () => {
    const evaluation = evaluateTenantIsolation(contract, tableInventory({
      service_requests: {
        columns: [],
        rlsEnabled: true,
      },
    }));

    expect(evaluation.status).toBe(STATUS_PENDING_SCHEMA);
    expect(evaluation.tableResults.find((result) => result.table === "service_requests")?.tenantSchemaStarted).toBe(false);
  });

  it("does not start guard mode from a resource column without the tenant key", () => {
    const evaluation = evaluateTenantIsolation(contract, tableInventory({
      service_requests: {
        columns: ["facility_id"],
        rlsEnabled: false,
      },
    }));

    expect(evaluation.status).toBe(STATUS_PENDING_SCHEMA);
    expect(evaluation.tableResults.find((result) => result.table === "service_requests")?.tenantSchemaStarted).toBe(false);
  });

  it("passes only when schema guardrails and executable scenario assertion refs are present", () => {
    const evaluation = evaluateTenantIsolation(contractWithScenarioAssertions(), tableInventory());

    expect(evaluation.status).toBe(STATUS_PASS);
    expect(evaluation.summary.readyBoundaryTables).toBe(contract.expectedTenantBoundaryTables.length);
    expect(evaluation.summary.readyTables).toBe(contract.expectedTenantOwnedTables.length);
    expect(evaluation.missingScenarios).toEqual([]);
  });

  it("keeps the required scenario contract explicit", () => {
    const scenarioIds = contract.requiredIsolationScenarios.map((scenario) => scenario.id);

    expect(new Set(scenarioIds)).toEqual(new Set([
      "tenant_a_cannot_read_tenant_b",
      "tenant_a_cannot_write_tenant_b",
      "wrong_tenant_negative_cases",
      "shared_nurse_no_cross_tenant_inference",
      "platform_admin_explicit_audited_access",
      "pooled_connection_tenant_cleanup",
    ]));
  });

  it("uses explicit exit codes for advisory readiness and enforce failures", () => {
    expect(exitCodeFor({ mode: "readiness", status: STATUS_PENDING_SCHEMA })).toBe(EXIT_OK);
    expect(exitCodeFor({ mode: "guard", status: STATUS_PENDING_SCHEMA })).toBe(EXIT_OK);
    expect(exitCodeFor({ mode: "guard", status: STATUS_FAIL })).toBe(EXIT_FAIL);
    expect(exitCodeFor({ mode: "enforce", status: STATUS_PENDING_SCHEMA })).toBe(EXIT_FAIL);
    expect(exitCodeFor({ mode: "enforce", status: STATUS_PASS })).toBe(EXIT_OK);
    expect(exitCodeFor({ mode: "enforce", errorCode: "MISSING_DATABASE_URL" })).toBe(EXIT_SKIPPED);
    expect(exitCodeFor({ mode: "guard", errorCode: "MISSING_DATABASE_URL" })).toBe(EXIT_FAIL);
  });

  it("fails enforce mode when live inspection is requested without DATABASE_URL", () => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const result = spawnSync("node", [scriptPath, "--mode", "enforce", "--source", "live"], {
      cwd: repoRoot,
      env,
      encoding: "utf8",
    });

    expect(result.status).toBe(EXIT_SKIPPED);
    expect(result.stderr).toContain("MISSING_DATABASE_URL");
  });

  it("prints current Drizzle readiness as an advisory state", () => {
    const stdout = execFileSync("node", [scriptPath, "--mode", "readiness", "--source", "drizzle"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(stdout).toContain("status=ADVISORY_PASS_PENDING_SCHEMA");
    expect(stdout).toContain("promotion_trigger=");
    expect(stdout).toContain("table=service_requests");
  });

  it("prints machine-readable JSON output", () => {
    const stdout = execFileSync("node", [scriptPath, "--mode", "readiness", "--source", "drizzle", "--format", "json"], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const parsed = JSON.parse(stdout);

    expect(parsed.status).toBe(STATUS_PENDING_SCHEMA);
    expect(parsed.summary.expectedTables).toBe(contract.expectedTenantOwnedTables.length);
    expect(parsed.tableResults[0]).toHaveProperty("table");
  });

  it("fails when an assertion ref points at a missing file", () => {
    const badContract = contractWithScenarioAssertions();
    badContract.requiredIsolationScenarios[0].assertionRefs = ["missing/tenant-isolation.test.ts#missing"];
    const evaluation = evaluateTenantIsolation(badContract, tableInventory());

    expect(evaluation.status).toBe(STATUS_FAIL);
    expect(evaluation.invalidScenarioRefs).toEqual([
      {
        scenario: "tenant_a_cannot_read_tenant_b",
        assertionRef: "missing/tenant-isolation.test.ts#missing",
        reason: "missing_file",
      },
    ]);
  });

  it("rejects invalid contracts before reporting readiness", () => {
    const root = mkdtempSync(join(tmpdir(), "nurseconnect-tenant-isolation-"));
    const contractPath = join(root, "contract.json");
    writeFileSync(contractPath, JSON.stringify({ version: "bad", tenantKey: "tenant_id" }));

    try {
      const result = spawnSync("node", [scriptPath, "--contract", contractPath], {
        cwd: repoRoot,
        encoding: "utf8",
      });

      expect(result.status).toBe(EXIT_FAIL);
      expect(result.stderr).toContain("Invalid tenant isolation contract");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
