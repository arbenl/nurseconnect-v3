import { describe, expect, it } from "vitest";

import {
  checkServiceRequestStatusWrites,
  findServiceRequestStatusWriteViolations,
} from "../lib/service-request-status-guard.mjs";

describe("service request status guard", () => {
  it("fails raw service request status updates outside domain-request", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "packages/domain-dispatch/src/bad.ts",
      `
        tx.update(serviceRequests).set({
          status: "assigned",
          updatedAt: now,
        });
      `,
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails raw service request status updates inside domain-request too", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "packages/domain-request/src/request-actions.ts",
      'tx.update(serviceRequests).set({ status: "assigned" });',
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails direct Drizzle status updates in production source", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-write.ts",
      'await tx.update(serviceRequests).where(eq(serviceRequests.id, id)).set({ status: "open" });',
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails schema-qualified Drizzle status updates", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-qualified.ts",
      'await tx.update(schema.serviceRequests).set({ status: "open" });',
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails aliased serviceRequests imports", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-alias.ts",
      `
        import { serviceRequests as sr } from "@nurseconnect/database/schema";
        await tx.update(sr).set({ status: "open" });
      `,
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails raw SQL status updates in production source", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-sql.ts",
      "await tx.execute(sql`update service_requests set status = 'open' where id = ${id}`);",
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails quoted raw SQL status updates", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-quoted-sql.ts",
      'await tx.execute(sql`UPDATE "service_requests" SET "status" = ${status}`);',
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails aliased raw SQL status updates", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-aliased-sql.ts",
      "await tx.execute(sql`UPDATE service_requests sr SET status = ${status}`);",
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails quoted Drizzle status keys", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-quoted-key.ts",
      'await tx.update(serviceRequests).set({ "status": "open" });',
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("fails typed indirect raw status update objects", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "apps/web/src/server/requests/bad-indirect.ts",
      `
        const updateData: Partial<typeof serviceRequests.$inferInsert> = {
          status: "open",
          updatedAt: now,
        };
        await tx.update(serviceRequests).set(updateData);
      `,
    );

    expect(violations.join("\n")).toContain("AuthorizedTransition helpers");
  });

  it("allows non-status service request updates", () => {
    const files = ["packages/domain-dispatch/src/assignment-policy.ts"];
    const violations = checkServiceRequestStatusWrites(files, () =>
      "tx.update(serviceRequests).set(requestStatusUpdate(transition, { updatedAt: now }));",
    );

    expect(violations).toEqual([]);
  });

  it("allows branded status update helper variables", () => {
    const violations = findServiceRequestStatusWriteViolations(
      "packages/domain-request/src/request-actions.ts",
      `
        const updateData = requestStatusUpdate(transition, expected, updateExtras);
        await tx.update(serviceRequests).set(updateData);
      `,
    );

    expect(violations).toEqual([]);
  });
});
