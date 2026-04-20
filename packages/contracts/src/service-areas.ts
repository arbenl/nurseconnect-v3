import { z } from "zod";

export const ServiceAreaStatusInfo = z.enum(["active", "paused"]);
export type ServiceAreaStatus = z.infer<typeof ServiceAreaStatusInfo>;

export const ServiceAreaSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  centerLat: z.string(),
  centerLng: z.string(),
  radiusMeters: z.number().int().positive(),
  status: ServiceAreaStatusInfo,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type ServiceAreaDto = z.infer<typeof ServiceAreaSchema>;

export const CreateServiceAreaSchema = z.object({
  label: z.string().trim().min(1).max(200),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(500).max(100_000),
});
export type CreateServiceAreaInput = z.infer<typeof CreateServiceAreaSchema>;

export const UpdateServiceAreaSchema = z
  .object({
    label: z.string().trim().min(1).max(200).optional(),
    centerLat: z.number().min(-90).max(90).optional(),
    centerLng: z.number().min(-180).max(180).optional(),
    radiusMeters: z.number().int().min(500).max(100_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one service area field is required",
  });
export type UpdateServiceAreaInput = z.infer<typeof UpdateServiceAreaSchema>;

export const AdminServiceAreaListResponseSchema = z.object({
  items: z.array(ServiceAreaSchema),
});
export type AdminServiceAreaListResponse = z.infer<typeof AdminServiceAreaListResponseSchema>;

export const ServiceAreaStatusChangeSchema = z.object({
  status: ServiceAreaStatusInfo,
});
export type ServiceAreaStatusChangeInput = z.infer<typeof ServiceAreaStatusChangeSchema>;
