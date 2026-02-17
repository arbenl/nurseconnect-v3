import { z } from "zod";

export const CreateRequestSchema = z.object({
    address: z.string().min(5, "Address must be at least 5 characters"),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

export type CreateRequestInput = z.infer<typeof CreateRequestSchema>;

export const RequestStatusInfo = z.enum(["open", "assigned", "enroute", "completed", "canceled"]);
export type RequestStatus = z.infer<typeof RequestStatusInfo>;
