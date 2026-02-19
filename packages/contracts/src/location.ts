import { z } from "zod";

export const NurseLocationUpdateRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type NurseLocationUpdateRequest = z.infer<typeof NurseLocationUpdateRequestSchema>;

export const NurseLocationUpdateResponseSchema = z.object({
  ok: z.literal(true),
  throttled: z.boolean(),
  lastUpdated: z.string().datetime({ offset: true }),
});
export type NurseLocationUpdateResponse = z.infer<typeof NurseLocationUpdateResponseSchema>;
