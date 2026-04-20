import type { NurseLocationUpdateResponse } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";

import { NurseLocationForbiddenError } from "./errors";

const { users, nurses, nurseLocations } = schema;

export const NURSE_LOCATION_THROTTLE_SECONDS = 30;

function toIsoString(value: Date | string) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

export async function updateMyNurseLocation(input: {
  actorUserId: string;
  lat: number;
  lng: number;
  serviceAreaId: string | null;
}): Promise<NurseLocationUpdateResponse> {
  const { actorUserId, lat, lng, serviceAreaId } = input;

  return db.transaction(async (tx) => {
    const [actor] = await tx
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, actorUserId));

    if (!actor || actor.role !== "nurse") {
      throw new NurseLocationForbiddenError("Forbidden: User is not a nurse");
    }

    const [nurse] = await tx
      .select({ userId: nurses.userId })
      .from(nurses)
      .where(eq(nurses.userId, actorUserId));

    if (!nurse) {
      throw new NurseLocationForbiddenError("Forbidden: Nurse profile is incomplete");
    }

    const upserted = await tx.execute<{ last_updated: Date; service_area_id: string | null }>(sql`
      INSERT INTO nurse_locations (nurse_user_id, lat, lng, service_area_id, last_updated)
      VALUES (${actorUserId}::uuid, ${String(lat)}::numeric, ${String(lng)}::numeric, ${serviceAreaId}::uuid, NOW())
      ON CONFLICT (nurse_user_id) DO UPDATE
      SET lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        service_area_id = EXCLUDED.service_area_id,
        last_updated = NOW()
      WHERE nurse_locations.last_updated <= NOW() - (${NURSE_LOCATION_THROTTLE_SECONDS} * INTERVAL '1 second')
      RETURNING last_updated, service_area_id
    `);

    if (upserted.rows.length > 0) {
      const lastUpdated = upserted.rows[0]!.last_updated;
      return {
        ok: true,
        throttled: false,
        lastUpdated: toIsoString(lastUpdated),
        serviceAreaId: upserted.rows[0]!.service_area_id,
      };
    }

    const [current] = await tx
      .select({
        lastUpdated: nurseLocations.lastUpdated,
        serviceAreaId: nurseLocations.serviceAreaId,
      })
      .from(nurseLocations)
      .where(eq(nurseLocations.nurseUserId, actorUserId));

    if (!current) {
      throw new Error("Failed to read nurse location after upsert");
    }

    return {
      ok: true,
      throttled: true,
      lastUpdated: toIsoString(current.lastUpdated),
      serviceAreaId: current.serviceAreaId,
    };
  });
}
