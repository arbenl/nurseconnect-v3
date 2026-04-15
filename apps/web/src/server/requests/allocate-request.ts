// apps/web/src/server/requests/allocate-request.ts
import { haversineMeters, type CreateRequestInput as ContractCreateRequestInput } from "@nurseconnect/contracts";
import { db, eq, schema, sql } from "@nurseconnect/database";
import { assertCreateRequestInvariants } from "@nurseconnect/domain-request";

import { appendRequestEvent } from "./request-events";

const { nurses, serviceRequests } = schema;

export type CreateRequestInput = ContractCreateRequestInput & {
    patientUserId: string;
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

    assertCreateRequestInvariants(input);

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
                requestType: input.requestType ?? "same_day",
                scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
                referralSource: input.referralSource ?? "consumer",
                referralPartnerId: input.referralPartnerId ?? null,
                careType: input.careType ?? null,
            })
            .returning();

        if (!req) {
            throw new Error("Failed to create request");
        }

        await appendRequestEvent(tx, {
            requestId: req.id,
            type: "request_created",
            actorUserId: patientUserId,
            fromStatus: null,
            toStatus: "open",
            meta: null,
        });

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
          JOIN users u ON u.id = nl.nurse_user_id
          WHERE n.is_available = true
            AND u.role = 'nurse'
            AND n.status = 'verified'
            AND (n.license_valid_until IS NULL OR n.license_valid_until > NOW())
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

        const assignedAt = new Date();

        const [updated] = await tx
            .update(serviceRequests)
            .set({
                assignedNurseUserId: chosen.nurseUserId,
                status: "assigned",
                assignedAt,
                updatedAt: assignedAt,
            })
            .where(eq(serviceRequests.id, req.id))
            .returning();

        if (!updated) {
            throw new Error("Failed to update request");
        }

        await tx
            .update(nurses)
            .set({
                isAvailable: false,
                updatedAt: assignedAt,
            })
            .where(eq(nurses.userId, chosen.nurseUserId));

        await appendRequestEvent(tx, {
            requestId: updated.id,
            type: "request_assigned",
            actorUserId: null,
            fromStatus: "open",
            toStatus: "assigned",
            meta: {
                nurseUserId: chosen.nurseUserId,
            },
        });

        return updated;
    });
}
