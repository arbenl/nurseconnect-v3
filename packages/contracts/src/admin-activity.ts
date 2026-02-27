import { z } from "zod";

import { RequestStatusInfo } from "./requests";

export const RequestReassignedMetadataSchema = z.object({
  previousNurseUserId: z.string().uuid().nullable(),
  newNurseUserId: z.string().uuid().nullable(),
});
export type RequestReassignedMetadata = z.infer<typeof RequestReassignedMetadataSchema>;

export const AdminReassignmentEventActivityItemSchema = z.object({
  source: z.literal("request-event"),
  id: z.number().int().positive(),
  requestId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  fromStatus: RequestStatusInfo.nullable(),
  toStatus: RequestStatusInfo.nullable(),
  metadata: RequestReassignedMetadataSchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type AdminReassignmentEventActivityItem = z.infer<typeof AdminReassignmentEventActivityItemSchema>;

export const AdminReassignmentAuditActivityItemSchema = z.object({
  source: z.literal("admin-audit"),
  id: z.number().int().positive(),
  action: z.literal("request.reassigned"),
  requestId: z.string().uuid(),
  actorUserId: z.string().uuid().nullable(),
  metadata: RequestReassignedMetadataSchema,
  createdAt: z.string().datetime({ offset: true }),
});
export type AdminReassignmentAuditActivityItem = z.infer<typeof AdminReassignmentAuditActivityItemSchema>;

export const AdminReassignmentActivityItemSchema = z.discriminatedUnion("source", [
  AdminReassignmentEventActivityItemSchema,
  AdminReassignmentAuditActivityItemSchema,
]);
export type AdminReassignmentActivityItem = z.infer<typeof AdminReassignmentActivityItemSchema>;

export const AdminReassignmentActivityResponseSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  items: z.array(AdminReassignmentActivityItemSchema),
});
export type AdminReassignmentActivityResponse = z.infer<typeof AdminReassignmentActivityResponseSchema>;

