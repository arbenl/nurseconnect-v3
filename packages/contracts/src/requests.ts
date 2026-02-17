import { z } from "zod";

export const CreateRequestSchema = z.object({
    address: z.string().min(5, "Address must be at least 5 characters"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
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
    assignedAt: z.string().nullable(),
    acceptedAt: z.string().nullable(),
    enrouteAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    canceledAt: z.string().nullable(),
    rejectedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
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
