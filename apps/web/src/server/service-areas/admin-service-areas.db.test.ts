import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  createAdminServiceArea,
  listAdminServiceAreas,
  setAdminServiceAreaStatus,
  updateAdminServiceArea,
} from "./admin-service-areas";

const { adminAuditLogs, serviceAreas, users } = schema;

describe.sequential("admin service area operations", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE admin_audit_logs RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE service_areas RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  async function seedAdmin() {
    const [admin] = await db
      .insert(users)
      .values({ email: "service-area-admin@test.local", role: "admin" })
      .returning();

    return admin!;
  }

  it("creates a service area and records an audit event", async () => {
    const admin = await seedAdmin();

    const created = await createAdminServiceArea({
      actorUserId: admin.id,
      input: {
        label: "Pristina",
        centerLat: 42.6629,
        centerLng: 21.1655,
        radiusMeters: 15000,
      },
    });

    expect(created).toMatchObject({
      label: "Pristina",
      centerLat: "42.662900",
      centerLng: "21.165500",
      radiusMeters: 15000,
      status: "active",
    });

    const [audit] = await db
      .select()
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.targetEntityId, created.id));

    expect(audit).toMatchObject({
      actorUserId: admin.id,
      action: "service_area.created",
      targetEntityType: "service_area",
      targetEntityId: created.id,
    });
  });

  it("updates fields, changes status, and lists normalized rows", async () => {
    const admin = await seedAdmin();
    const created = await createAdminServiceArea({
      actorUserId: admin.id,
      input: {
        label: "Pristina",
        centerLat: 42.6629,
        centerLng: 21.1655,
        radiusMeters: 15000,
      },
    });

    const updated = await updateAdminServiceArea({
      actorUserId: admin.id,
      id: created.id,
      input: {
        label: "Pristina Metro",
        radiusMeters: 25000,
      },
    });

    const paused = await setAdminServiceAreaStatus({
      actorUserId: admin.id,
      id: created.id,
      status: "paused",
    });

    const rows = await listAdminServiceAreas();

    expect(updated).toMatchObject({
      label: "Pristina Metro",
      radiusMeters: 25000,
    });
    expect(paused.status).toBe("paused");
    expect(rows.items).toHaveLength(1);
    expect(rows.items[0]).toMatchObject({
      id: created.id,
      label: "Pristina Metro",
      status: "paused",
    });

    const audits = await db
      .select({ action: adminAuditLogs.action })
      .from(adminAuditLogs)
      .where(eq(adminAuditLogs.targetEntityId, created.id));

    expect(audits.map((row) => row.action)).toEqual([
      "service_area.created",
      "service_area.updated",
      "service_area.paused",
    ]);

    const [persisted] = await db.select().from(serviceAreas).where(eq(serviceAreas.id, created.id));
    expect(persisted?.updatedAt).toBeInstanceOf(Date);
  });
});
