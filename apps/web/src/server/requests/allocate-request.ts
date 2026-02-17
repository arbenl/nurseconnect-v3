// apps/web/src/server/requests/allocate-request.ts
import { haversineMeters } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";

const { serviceRequests } = schema;

export type CreateRequestInput = {
    patientUserId: string;
    address: string;
    lat: number;
    lng: number;
};

// Small helper to keep deterministic tie-breaks.
function compareCandidates(
    a: { meters: number; nurseUserId: string },
    b: { meters: number; nurseUserId: string }
) {
    if (a.meters !== b.meters) return a.meters - b.meters;
    return a.nurseUserId.localeCompare(b.nurseUserId);
}

/**
 * Creates a service request and atomically assigns nearest available nurse
 * using FOR UPDATE SKIP LOCKED to avoid double-assign under concurrency.
 */
export async function createAndAssignRequest(input: CreateRequestInput) {
    const { patientUserId, address, lat, lng } = input;

    return await db.transaction(async (tx) => {
        // 1) create request (open)
        const [req] = await tx
            .insert(serviceRequests)
            .values({
                patientUserId,
                address,
                lat: String(lat), // NUMERIC in db; store as string for drizzle numeric
                lng: String(lng),
                status: "open",
            })
            .returning();

        if (!req) {
            throw new Error("Failed to create request");
        }

        // 2) lock available nurse location rows (skip locked)
        // We lock nurse_locations rows so concurrent allocators won't pick same nurse.
        const rows = await tx.execute<{
            nurse_user_id: string;
            lat: string;
            lng: string;
        }>(sql`
          SELECT nl.nurse_user_id, nl.lat::text as lat, nl.lng::text as lng
          FROM nurse_locations nl
          JOIN nurses n ON n.user_id = nl.nurse_user_id
          WHERE n.is_available = true
          FOR UPDATE OF nl SKIP LOCKED
        `);

        const candidates = rows.rows.map((r) => ({
            nurseUserId: r.nurse_user_id,
            meters: haversineMeters(
                { lat, lng },
                { lat: Number(r.lat), lng: Number(r.lng) }
            ),
        }));

        if (candidates.length === 0) {
            // leave as open (unassigned)
            return req;
        }

        candidates.sort(compareCandidates);
        const chosen = candidates[0]!;

        const [updated] = await tx
            .update(serviceRequests)
            .set({
                assignedNurseUserId: chosen.nurseUserId,
                status: "assigned",
            })
            .where(eq(serviceRequests.id, req.id))
            .returning();

        if (!updated) {
            throw new Error("Failed to update request");
        }

        return updated;
    });
}
