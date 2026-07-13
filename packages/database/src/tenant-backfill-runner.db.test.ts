import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it } from "vitest";

import { db } from "./db";
import { requestEvents } from "./schema";
import { sql } from "drizzle-orm";
import {
  primaryOrganizationId,
  seedOwnedRequest,
  seedTenantBackfillFixture,
} from "./tenant-backfill-fixture";

const runner = fileURLToPath(new URL("../../../scripts/backfill-tenant-ownership.mjs", import.meta.url));
describe.sequential("tenant ownership backfill runner", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE organizations, users RESTART IDENTITY CASCADE`);
  });

  it("backfills nullable child ownership and reconciles to zero", async () => {
    await seedTenantBackfillFixture();

    const result = runBackfill();
    expect(result.status, result.stderr).toBe(0);
    const evidence = JSON.parse(result.stdout);
    expect(evidence.status).toBe("pass");
    expect(evidence.reconciliation.every((row: { count: number }) => row.count === 0)).toBe(true);
    expect(evidence.updates.every((row: { rows: number }) => row.rows === 1)).toBe(true);

    const second = runBackfill();
    expect(second.status, second.stderr).toBe(0);
    expect(JSON.parse(second.stdout).updates.every((row: { rows: number }) => row.rows === 0)).toBe(true);

    const queryResult = await db.execute<{ count: number }>(sql`
      SELECT count(*)::int AS count FROM service_request_events WHERE organization_id IS NULL
    `);
    const [{ count }] = Array.isArray(queryResult) ? queryResult : queryResult.rows;
    expect(count).toBe(0);
  });

  it("fails closed when non-null child ownership disagrees with its request", async () => {
    const requestId = await seedOwnedRequest(true);
    await db.insert(requestEvents).values({
      requestId,
      organizationId: primaryOrganizationId,
      type: "request_created",
    });

    const result = runBackfill("--check-only");
    expect(result.status).toBe(1);
    const evidence = JSON.parse(result.stdout);
    expect(evidence.status).toBe("fail");
    expect(evidence.reconciliation).toContainEqual({
      name: "event_request_org_mismatch",
      count: 1,
    });
    expect(evidence.reconciliation).toContainEqual({
      name: "service_request_non_default_org",
      count: 1,
    });
  });
});

function runBackfill(argument?: string) {
  const result = spawnSync(process.execPath, [runner, ...(argument ? [argument] : [])], {
    encoding: "utf8",
    env: {
      ...process.env,
      PSQL_BIN: process.env.PSQL_BIN ?? "/opt/homebrew/opt/libpq/bin/psql",
      NC_TB_01_BACKFILL_BATCH_SIZE: "1",
    },
  });
  if (result.error) throw result.error;
  return result;
}
