import type {
  AdminServiceAreaListResponse,
  CreateServiceAreaInput,
  ServiceAreaDto,
  ServiceAreaStatus,
  UpdateServiceAreaInput,
} from "@nurseconnect/contracts";
import { asc, db, eq, schema } from "@nurseconnect/database";

import { recordAdminAction } from "@/server/admin/audit";

const { serviceAreas } = schema;

export class ServiceAreaNotFoundError extends Error {
  constructor(id: string) {
    super(`Service area not found: ${id}`);
    this.name = "ServiceAreaNotFoundError";
  }
}

function normalizeServiceArea(row: typeof serviceAreas.$inferSelect): ServiceAreaDto {
  return {
    id: row.id,
    label: row.label,
    centerLat: row.centerLat,
    centerLng: row.centerLng,
    radiusMeters: row.radiusMeters,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminServiceAreas(): Promise<AdminServiceAreaListResponse> {
  const rows = await db
    .select()
    .from(serviceAreas)
    .orderBy(asc(serviceAreas.label), asc(serviceAreas.id));

  return { items: rows.map(normalizeServiceArea) };
}

export async function createAdminServiceArea({
  actorUserId,
  input: payload,
}: {
  actorUserId: string;
  input: CreateServiceAreaInput;
}): Promise<ServiceAreaDto> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(serviceAreas)
      .values({
        label: payload.label,
        centerLat: String(payload.centerLat),
        centerLng: String(payload.centerLng),
        radiusMeters: payload.radiusMeters,
        status: "active",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create service area");
    }

    await recordAdminAction(
      {
        actorUserId,
        action: "service_area.created",
        targetEntityType: "service_area",
        targetEntityId: created.id,
        details: {
          label: created.label,
          centerLat: created.centerLat,
          centerLng: created.centerLng,
          radiusMeters: created.radiusMeters,
          status: created.status,
        },
      },
      tx,
    );

    return normalizeServiceArea(created);
  });
}

export async function updateAdminServiceArea({
  actorUserId,
  id,
  input: payload,
}: {
  actorUserId: string;
  id: string;
  input: UpdateServiceAreaInput;
}): Promise<ServiceAreaDto> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(serviceAreas)
      .set({
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.centerLat !== undefined ? { centerLat: String(payload.centerLat) } : {}),
        ...(payload.centerLng !== undefined ? { centerLng: String(payload.centerLng) } : {}),
        ...(payload.radiusMeters !== undefined ? { radiusMeters: payload.radiusMeters } : {}),
        updatedAt: new Date(),
      })
      .where(eq(serviceAreas.id, id))
      .returning();

    if (!updated) {
      throw new ServiceAreaNotFoundError(id);
    }

    await recordAdminAction(
      {
        actorUserId,
        action: "service_area.updated",
        targetEntityType: "service_area",
        targetEntityId: updated.id,
        details: {
          changes: payload,
        },
      },
      tx,
    );

    return normalizeServiceArea(updated);
  });
}

export async function setAdminServiceAreaStatus(input: {
  actorUserId: string;
  id: string;
  status: ServiceAreaStatus;
}): Promise<ServiceAreaDto> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(serviceAreas)
      .set({
        status: input.status,
        updatedAt: new Date(),
      })
      .where(eq(serviceAreas.id, input.id))
      .returning();

    if (!updated) {
      throw new ServiceAreaNotFoundError(input.id);
    }

    await recordAdminAction(
      {
        actorUserId: input.actorUserId,
        action: input.status === "paused" ? "service_area.paused" : "service_area.reactivated",
        targetEntityType: "service_area",
        targetEntityId: updated.id,
        details: {
          status: input.status,
        },
      },
      tx,
    );

    return normalizeServiceArea(updated);
  });
}
