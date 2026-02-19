import type { NurseLocationUpdateResponse } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";

const { users, nurses, nurseLocations } = schema;

export const NURSE_LOCATION_THROTTLE_SECONDS = 30;

export class NurseLocationForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "NurseLocationForbiddenError";
  }
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

export async function updateMyNurseLocation(input: {
  actorUserId: string;
  lat: number;
  lng: number;
}): Promise<NurseLocationUpdateResponse> {
  const { actorUserId, lat, lng } = input;

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

    const upserted = await tx.execute<{ last_updated: Date }>(sql`
      INSERT INTO nurse_locations (nurse_user_id, lat, lng, last_updated)
      VALUES (${actorUserId}::uuid, ${String(lat)}::numeric, ${String(lng)}::numeric, NOW())
      ON CONFLICT (nurse_user_id) DO UPDATE
      SET lat = EXCLUDED.lat, lng = EXCLUDED.lng, last_updated = NOW()
      WHERE nurse_locations.last_updated <= NOW() - (${NURSE_LOCATION_THROTTLE_SECONDS} * INTERVAL '1 second')
      RETURNING last_updated
    `);

    if (upserted.rows.length > 0) {
      const lastUpdated = upserted.rows[0]!.last_updated;
      return {
        ok: true,
        throttled: false,
        lastUpdated: toIsoString(lastUpdated),
      };
    }

    const [current] = await tx
      .select({ lastUpdated: nurseLocations.lastUpdated })
      .from(nurseLocations)
      .where(eq(nurseLocations.nurseUserId, actorUserId));

    if (!current) {
      throw new Error("Failed to read nurse location after upsert");
    }

    return {
      ok: true,
      throttled: true,
      lastUpdated: toIsoString(current.lastUpdated),
    };
  });
}
