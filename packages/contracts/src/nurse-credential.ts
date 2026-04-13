import { z } from "zod";

export const NurseStatusEnum = z.enum([
  "draft",
  "submitted",
  "under_review",
  "verified",
  "rejected",
  "suspended",
  "expired",
  "renewal_pending",
]);
export type NurseStatus = z.infer<typeof NurseStatusEnum>;

export const NurseCredentialSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: NurseStatusEnum,
  licenseNumber: z.string().nullable(),
  licenseJurisdiction: z.string().nullable(),
  specialization: z.string().nullable(),
  licenseValidUntil: z.string().datetime({ offset: true }).nullable(),
  verifiedBy: z.string().uuid().nullable(),
  verifiedAt: z.string().datetime({ offset: true }).nullable(),
  isAvailable: z.boolean(),
});
export type NurseCredential = z.infer<typeof NurseCredentialSchema>;

export const AdminVerifyNurseSchema = z.object({
  licenseValidUntil: z.string().datetime({ offset: true }),
  licenseJurisdiction: z.string().min(1).optional(),
});
export type AdminVerifyNurseInput = z.infer<typeof AdminVerifyNurseSchema>;

export const AdminSuspendNurseSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type AdminSuspendNurseInput = z.infer<typeof AdminSuspendNurseSchema>;

export const AdminRejectNurseSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});
export type AdminRejectNurseInput = z.infer<typeof AdminRejectNurseSchema>;
