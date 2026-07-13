import { describe, expect, it } from "vitest";

import { classifyTenantQuery } from "./tenant-query-classifier";

describe("tenant query classifier", () => {
  it("recognizes quoted, qualified, aliased, and multi-table access", () => {
    expect(classifyTenantQuery(`
      SELECT * FROM "public"."service_requests" sr
      JOIN assignments a ON a.request_id = sr.id
    `)).toMatchObject({ operation: "select", tables: ["assignments", "service_requests"] });
    expect(classifyTenantQuery(`INSERT INTO "patients" (id) VALUES ($1)`).tables).toEqual(["patients"]);
    expect(classifyTenantQuery(`UPDATE public.visits SET branch_id = $1`).tables).toEqual(["visits"]);
    expect(classifyTenantQuery(`DELETE FROM nurse_payouts WHERE id = $1`).tables).toEqual(["nurse_payouts"]);
  });

  it("ignores literals, comments, substrings, and tracked-name CTE aliases", () => {
    expect(classifyTenantQuery(`SELECT 'FROM service_requests' FROM users`).tables).toEqual([]);
    expect(classifyTenantQuery(`SELECT 1 FROM users -- JOIN assignments`).tables).toEqual([]);
    expect(classifyTenantQuery(`SELECT 1 FROM service_requests_archive`).tables).toEqual([]);
    expect(classifyTenantQuery(`WITH visits AS (SELECT * FROM users) SELECT * FROM visits`).tables).toEqual([]);
  });

  it("finds tracked tables inside CTE bodies", () => {
    expect(classifyTenantQuery(`WITH recent AS (SELECT * FROM service_request_events) SELECT * FROM recent`).tables)
      .toEqual(["service_request_events"]);
    expect(classifyTenantQuery(`WITH visits AS (SELECT * FROM public.visits) SELECT * FROM visits`))
      .toMatchObject({ operation: "select", tables: ["visits"] });
  });

  it("finds tracked tables after untracked comma-separated relations", () => {
    expect(classifyTenantQuery(`SELECT * FROM users, service_requests`).tables).toEqual(["service_requests"]);
  });

  it("fails closed on oversized queries", () => {
    expect(classifyTenantQuery(`SELECT '${"x".repeat(262_145)}'`)).toEqual({
      operation: "unknown",
      oversize: true,
      tables: [],
    });
  });
});
