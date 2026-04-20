// apps/web/src/server/requests/allocate-request.ts
import type { CreateRequestInput as ContractCreateRequestInput } from "@nurseconnect/contracts";
import { db, schema } from "@nurseconnect/database";
import {
    assignRequestToNurse,
    findContainingServiceArea,
    getActiveServiceAreas,
    selectDispatchCandidate,
} from "@nurseconnect/domain-dispatch";
import { appendRequestEvent, assertCreateRequestInvariants } from "@nurseconnect/domain-request";

const { serviceRequests } = schema;

export type CreateRequestInput = Omit<
    ContractCreateRequestInput,
    "requestType" | "referralSource" | "careType"
> & {
    actorUserId?: string;
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
    const actorUserId = input.actorUserId ?? patientUserId;
    const requestType = input.requestType ?? "same_day";
    const referralSource = input.referralSource ?? "consumer";

    return await db.transaction(async (tx) => {
        const activeServiceAreas = await getActiveServiceAreas(tx);
        const serviceArea = findContainingServiceArea({ lat, lng }, activeServiceAreas);
        const createInvariants = {
            requestType,
            scheduledFor: input.scheduledFor,
            serviceAreaId: serviceArea?.id ?? null,
        };

        assertCreateRequestInvariants(createInvariants);
        const serviceAreaId = createInvariants.serviceAreaId;

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
                serviceAreaId,
                careType: input.careType ?? null,
            })
            .returning();

        if (!req) {
            throw new Error("Failed to create request");
        }

        await appendRequestEvent(tx, {
            requestId: req.id,
            type: "request_created",
            actorUserId,
            fromStatus: null,
            toStatus: "open",
            meta: null,
        });

        const chosen = await selectDispatchCandidate(tx, { lat, lng }, serviceAreaId);
        if (!chosen) {
            // leave as open (unassigned)
            return req;
        }

        return assignRequestToNurse(tx, {
            request: req,
            nurseUserId: chosen.nurseUserId,
            skipEligibilityValidation: true,
        });
    });
}
