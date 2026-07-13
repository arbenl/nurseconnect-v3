import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { db } from "./db";
import * as schema from "./schema";
import { withTenantContext } from "./tenant-context";
import { tenantQueryObserver } from "./tenant-query-observer";

const organizationId = "11111111-1111-4111-8111-111111111111";

describe("tenant query provenance", () => {
  it("preserves nested relational query operation provenance", async () => {
    const record = vi.spyOn(tenantQueryObserver, "recordWrongExecutor");

    await withTenantContext(db, organizationId, async () => {
      await db.query.serviceRequests.findMany({ limit: 1 });
    }, "admin.activity");

    expect(record).toHaveBeenCalledWith("admin.activity", "findMany");
    record.mockRestore();
  });

  it("keeps root builder operations stable across chaining", async () => {
    const record = vi.spyOn(tenantQueryObserver, "recordWrongExecutor");

    await withTenantContext(db, organizationId, async () => {
      void db.select({ id: schema.serviceRequests.id })
        .from(schema.serviceRequests)
        .where(eq(schema.serviceRequests.id, organizationId));
      void db.insert(schema.serviceRequests).values({
        patientUserId: organizationId,
        address: "not-executed",
        lat: "0",
        lng: "0",
      });
      void db.update(schema.serviceRequests)
        .set({ updatedAt: new Date(0) })
        .where(eq(schema.serviceRequests.id, organizationId));
      void db.delete(schema.serviceRequests).where(eq(schema.serviceRequests.id, organizationId));
    }, "admin.activity");

    expect(record.mock.calls).toEqual([
      ["admin.activity", "select"],
      ["admin.activity", "insert"],
      ["admin.activity", "update"],
      ["admin.activity", "delete"],
    ]);
    record.mockRestore();
  });
});
