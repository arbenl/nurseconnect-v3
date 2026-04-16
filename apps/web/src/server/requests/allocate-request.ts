// apps/web/src/server/requests/allocate-request.ts
import type { CreateRequestInput as ContractCreateRequestInput } from "@nurseconnect/contracts";
import { db, eq, schema } from "@nurseconnect/database";
import { selectDispatchCandidate } from "@nurseconnect/domain-dispatch";
import { assertCreateRequestInvariants } from "@nurseconnect/domain-request";

import { appendRequestEvent } from "./request-events";

const { nurses, serviceRequests } = schema;

export type CreateRequestInput = Omit<
    ContractCreateRequestInput,
    "requestType" | "referralSource" | "careType"
> & {
    patientUserId: string;
    requestType?: ContractCreateRequestInput["requestType"];
    referralSource?: ContractCreateRequestInput["referralSource"];
    careType?: ContractCreateRequestInput["careType"] | null;
};

/**
 * Creates a service request and atomically assigns nearest available nurse
 * using FOR UPDATE SKIP LOCKED to avoid double-assign under concurrency.
 */
export async function createAndAssignRequest(input: CreateRequestInput) {
    const { patientUserId, address, lat, lng } = input;
    const requestType = input.requestType ?? "same_day";
    const referralSource = input.referralSource ?? "consumer";

    assertCreateRequestInvariants({
        requestType,
        scheduledFor: input.scheduledFor,
    });

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
                requestType,
                scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
                referralSource,
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

        const chosen = await selectDispatchCandidate(tx, { lat, lng });
        if (!chosen) {
            // leave as open (unassigned)
            return req;
        }

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
