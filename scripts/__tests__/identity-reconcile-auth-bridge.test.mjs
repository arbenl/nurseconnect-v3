import { describe, expect, it } from "vitest";

import {
  buildReport,
  collectReconciliation,
  formatText,
  parseArgs,
  queries,
  redactRows,
} from "../identity/reconcile-auth-bridge.mjs";

describe("identity auth bridge reconciliation", () => {
  it("parses bounded report options", () => {
    const originalCi = process.env.CI;
    process.env.CI = "false";
    try {
      expect(parseArgs(["--json", "--include-identifiers", "--limit", "5"])).toEqual({
        json: true,
        includeIdentifiers: true,
        limit: 5,
      });
    } finally {
      if (originalCi === undefined) delete process.env.CI;
      else process.env.CI = originalCi;
    }

    expect(() => parseArgs(["--limit", "0"])).toThrow("--limit must be an integer");
    expect(() => parseArgs(["--limit", "501"])).toThrow("--limit must be an integer");
    expect(() => parseArgs(["--limit", "--json"])).toThrow("--limit requires a value");
    expect(() => parseArgs(["--bad"])).toThrow("Unknown argument");
    expect(parseArgs(["--help"]).help).toBe(true);
  });

  it("blocks identifier disclosure in CI", () => {
    const originalCi = process.env.CI;
    for (const value of ["true", "1"]) {
      process.env.CI = value;
      try {
        expect(() => parseArgs(["--include-identifiers"])).toThrow(
          "--include-identifiers is forbidden in CI",
        );
      } finally {
        if (originalCi === undefined) delete process.env.CI;
        else process.env.CI = originalCi;
      }
    }
  });

  it("redacts row identifiers unless explicitly requested", () => {
    const rows = [
      {
        id: "user-1",
        auth_id: "auth-1",
        email: "patient@example.test",
        role: "patient",
        created_at: "2026-06-02T00:00:00Z",
      },
    ];

    expect(redactRows(rows, false)).toEqual([
      {
        role: "patient",
        createdAt: "2026-06-02T00:00:00Z",
      },
    ]);
    expect(redactRows(rows, true)[0]).toMatchObject({
      userId: "user-1",
      authId: "auth-1",
    });
    expect(JSON.stringify(redactRows(rows, true))).not.toContain("patient@example.test");
  });

  it("builds a deterministic policy and migration-plan report", () => {
    const report = buildReport(
      {
        shellUsers: [{ role: "patient", created_at: "2026-06-02T00:00:00Z" }],
        missingAuthUsers: [],
        missingDomainUsers: [{ auth_id: "auth-2", created_at: "2026-06-02T00:00:00Z" }],
        counts: { shellUsers: 12, missingAuthUsers: 0, missingDomainUsers: 7 },
      },
      { generatedAt: "2026-06-02T12:00:00Z" },
    );

    expect(report.counts).toEqual({
      shellUsers: 12,
      missingAuthUsers: 0,
      missingDomainUsers: 7,
    });
    expect(report.policy.shellUsers).toContain("pre-auth");
    expect(report.stagedMigrationPlan.join("\n")).toContain("Add FK");
    expect(report.stagedMigrationPlan.join("\n")).toContain("Add NOT NULL");
    expect(formatText(report)).toContain("Staged migration plan:");
  });

  it("collects the three reconciliation categories", async () => {
    const calls = [];
    const client = {
      async query(query, params) {
        calls.push({ query, params });
        if (query.endsWith("Count")) return { rows: [{ count: 99 }] };
        if (query.includes("COUNT(*)")) return { rows: [{ count: query === queries.missingAuthUsersCount ? 2 : 0 }] };
        return { rows: query === queries.missingAuthUsers ? [{ role: "admin" }] : [] };
      },
    };

    const results = await collectReconciliation(client, { limit: 7 });

    expect(calls).toHaveLength(6);
    expect(calls.slice(0, 3).every((call) => call.params[0] === 7)).toBe(true);
    expect(calls.map((call) => call.query)).toEqual([
      queries.shellUsers,
      queries.missingAuthUsers,
      queries.missingDomainUsers,
      queries.shellUsersCount,
      queries.missingAuthUsersCount,
      queries.missingDomainUsersCount,
    ]);
    expect(queries.missingDomainUsers).toContain("NULL AS role");
    expect(results.missingAuthUsers).toEqual([{ role: "admin" }]);
    expect(results.counts.missingAuthUsers).toBe(2);
  });
});
