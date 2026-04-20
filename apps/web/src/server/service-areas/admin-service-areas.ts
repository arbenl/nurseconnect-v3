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

export async function createAdminServiceArea(input: {
  actorUserId: string;
  input: CreateServiceAreaInput;
}): Promise<ServiceAreaDto> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(serviceAreas)
      .values({
        label: input.input.label,
        centerLat: String(input.input.centerLat),
        centerLng: String(input.input.centerLng),
        radiusMeters: input.input.radiusMeters,
        status: "active",
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create service area");
    }

    await recordAdminAction(
      {
        actorUserId: input.actorUserId,
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

export async function updateAdminServiceArea(input: {
  actorUserId: string;
  id: string;
  input: UpdateServiceAreaInput;
}): Promise<ServiceAreaDto> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(serviceAreas)
      .set({
        ...(input.input.label !== undefined ? { label: input.input.label } : {}),
        ...(input.input.centerLat !== undefined ? { centerLat: String(input.input.centerLat) } : {}),
        ...(input.input.centerLng !== undefined ? { centerLng: String(input.input.centerLng) } : {}),
        ...(input.input.radiusMeters !== undefined ? { radiusMeters: input.input.radiusMeters } : {}),
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
        action: "service_area.updated",
        targetEntityType: "service_area",
        targetEntityId: updated.id,
        details: {
          changes: input.input,
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
