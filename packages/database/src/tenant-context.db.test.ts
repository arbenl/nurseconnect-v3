import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import { db, dbPool } from "./db";
import * as schema from "./schema";
import { assertTenantContext, type TenantQueryExecutor, withTenantContext } from "./tenant-context";

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const orgC = "33333333-3333-4333-8333-333333333333";

async function currentTenant(database: TenantQueryExecutor = db) {
  const result = await database.execute(sql`SELECT current_setting('app.current_tenant_id', true) AS tenant_id`);

  const rows = Array.isArray(result) ? result : result.rows ?? [];
  return (rows.at(0)?.tenant_id as string | null | undefined) ?? "";
}

describe("withTenantContext", () => {
  it("sets tenant context inside the transaction and clears it after commit", async () => {
    const seenTenant = await withTenantContext(db, orgA, async (tx) => {
      await assertTenantContext(tx, orgA);
      return currentTenant(tx);
    });

    expect(seenTenant).toBe(orgA);
    expect(await currentTenant()).toBe("");
  });

  it("clears tenant context on the same physical connection after commit", async () => {
    const client = await dbPool.connect();
    const clientDb = drizzle(client, { schema });

    try {
      await withTenantContext(clientDb, orgA, async (tx) => {
        await assertTenantContext(tx, orgA);
        return currentTenant(tx);
      });

      const result = await client.query<{ tenant_id: string | null }>(
        "SELECT current_setting('app.current_tenant_id', true) AS tenant_id",
      );

      expect(result.rows.at(0)?.tenant_id ?? "").toBe("");
    } finally {
      client.release();
    }
  });

  it("does not leak tenant context across concurrent transactions", async () => {
    const seenTenants = await Promise.all(
      [orgA, orgB, orgC].map((organizationId) =>
        withTenantContext(db, organizationId, async (tx) => {
          await tx.execute(sql`SELECT pg_sleep(0.02)`);
          await assertTenantContext(tx, organizationId);
          return currentTenant(tx);
        }),
      ),
    );

    expect(seenTenants).toEqual([orgA, orgB, orgC]);
    expect(await currentTenant()).toBe("");
  });

  it("does not leak sequential tenant contexts on one physical connection", async () => {
    const client = await dbPool.connect();
    const clientDb = drizzle(client, { schema });

    try {
      await withTenantContext(clientDb, orgA, async (tx) => currentTenant(tx));
      await withTenantContext(clientDb, orgB, async (tx) => {
        await assertTenantContext(tx, orgB);
        return currentTenant(tx);
      });

      const result = await client.query<{ tenant_id: string | null }>(
        "SELECT current_setting('app.current_tenant_id', true) AS tenant_id",
      );

      expect(result.rows.at(0)?.tenant_id ?? "").toBe("");
    } finally {
      client.release();
    }
  });

  it("rejects nested tenant contexts instead of overriding the outer tenant", async () => {
    await expect(
      withTenantContext(db, orgA, async () =>
        withTenantContext(db, orgB, async () => {
          throw new Error("nested callback should not run");
        }),
      ),
    ).rejects.toThrow("Tenant context already active");

    expect(await currentTenant()).toBe("");
  });
});
