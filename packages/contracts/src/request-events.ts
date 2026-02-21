import { z } from "zod";

import { RequestStatusInfo } from "./requests";

export const RequestEventTypeSchema = z.enum([
    "request_created",
    "request_assigned",
    "request_accepted",
    "request_rejected",
    "request_enroute",
    "request_completed",
    "request_canceled",
    "request_reassigned",
]);

export type RequestEventType = z.infer<typeof RequestEventTypeSchema>;

export const RequestEventSchema = z.object({
    id: z.number().int().positive(),
    requestId: z.string().uuid(),
    type: RequestEventTypeSchema,
    actorUserId: z.string().uuid().nullable(),
    fromStatus: RequestStatusInfo.nullable(),
    toStatus: RequestStatusInfo.nullable(),
    meta: z.record(z.string(), z.unknown()).nullable().optional(),
    createdAt: z.string().datetime({ offset: true }),
});

export type RequestEvent = z.infer<typeof RequestEventSchema>;

export const GetRequestEventsResponseSchema = z.array(RequestEventSchema);
export type GetRequestEventsResponse = z.infer<typeof GetRequestEventsResponseSchema>;
