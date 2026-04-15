import { z } from "zod";

export const CreateRequestSchema = z.object({
    address: z.string().min(5, "Address must be at least 5 characters"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    requestType: z.enum(["scheduled", "same_day"]).default("same_day"),
    scheduledFor: z.string().datetime({ offset: true }).nullable().optional(),
    referralSource: z.enum(["consumer", "partner"]).default("consumer"),
    referralPartnerId: z.string().uuid().nullable().optional(),
    careType: z.string().min(1).optional(),
});

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

export const RequestStatusInfo = z.enum([
    "open",
    "assigned",
    "accepted",
    "enroute",
    "completed",
    "canceled",
    "rejected",
]);
export type RequestStatus = z.infer<typeof RequestStatusInfo>;

export const ServiceRequestSchema = z.object({
    id: z.string().uuid(),
    patientUserId: z.string().uuid(),
    assignedNurseUserId: z.string().uuid().nullable(),
    status: RequestStatusInfo,
    address: z.string(),
    lat: z.string(),
    lng: z.string(),
    requestType: z.string(),
    scheduledFor: z.string().datetime({ offset: true }).nullable(),
    referralSource: z.string(),
    referralPartnerId: z.string().uuid().nullable(),
    careType: z.string().nullable(),
    assignedAt: z.string().datetime({ offset: true }).nullable(),
    acceptedAt: z.string().datetime({ offset: true }).nullable(),
    enrouteAt: z.string().datetime({ offset: true }).nullable(),
    completedAt: z.string().datetime({ offset: true }).nullable(),
    canceledAt: z.string().datetime({ offset: true }).nullable(),
    rejectedAt: z.string().datetime({ offset: true }).nullable(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
});
export type ServiceRequestDto = z.infer<typeof ServiceRequestSchema>;

export const AcceptRequestSchema = z.object({});
export type AcceptRequestInput = z.infer<typeof AcceptRequestSchema>;

export const RejectRequestSchema = z.object({
    reason: z.string().trim().min(1).max(500).optional(),
});
export type RejectRequestInput = z.infer<typeof RejectRequestSchema>;

export const RequestActionResponseSchema = z.object({
    request: ServiceRequestSchema,
});
export type RequestActionResponse = z.infer<typeof RequestActionResponseSchema>;

export const ActiveRequestStatusInfo = z.enum([
    "open",
    "assigned",
    "accepted",
    "enroute",
]);
export type ActiveRequestStatus = z.infer<typeof ActiveRequestStatusInfo>;

export const RequestSeverityBandInfo = z.enum([
    "critical",
    "high",
    "medium",
    "low",
]);
export type RequestSeverityBand = z.infer<typeof RequestSeverityBandInfo>;

export const AdminActiveRequestQueueItemSchema = z.object({
    requestId: z.string().uuid(),
    status: ActiveRequestStatusInfo,
    requestType: z.enum(["scheduled", "same_day"]),
    referralSource: z.enum(["consumer", "partner"]),
    careType: z.string().nullable(),
    severityScore: z.number().int().nonnegative(),
    severityBand: RequestSeverityBandInfo,
    waitMinutes: z.number().int().nonnegative(),
    lastEventAt: z.string().datetime({ offset: true }),
    createdAt: z.string().datetime({ offset: true }),
    assignedNurse: z.enum(["assigned", "unassigned"]),
    locationHint: z.string().min(1),
});
export type AdminActiveRequestQueueItem = z.infer<typeof AdminActiveRequestQueueItemSchema>;

export const AdminActiveRequestQueueResponseSchema = z.object({
    generatedAt: z.string().datetime({ offset: true }),
    items: z.array(AdminActiveRequestQueueItemSchema),
});
export type AdminActiveRequestQueueResponse = z.infer<typeof AdminActiveRequestQueueResponseSchema>;
