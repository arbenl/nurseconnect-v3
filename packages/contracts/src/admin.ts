import { z } from "zod";

import { RequestEventSchema } from "./request-events";
import { RequestStatusInfo } from "./requests";

export const AdminRoleSchema = z.enum(["admin", "nurse", "patient"]);

export const AdminListPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const AdminUsersListQuerySchema = AdminListPaginationSchema;

export const AdminNursesListQuerySchema = AdminListPaginationSchema;

export const AdminRequestsListQuerySchema = AdminListPaginationSchema.extend({
  status: RequestStatusInfo.optional(),
});

export const AdminUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: AdminRoleSchema,
  authId: z.string().nullable(),
  firebaseUid: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const AdminUsersListResponseSchema = z.object({
  items: z.array(AdminUserSchema),
  nextCursor: z.string().nullable().optional(),
});

export const AdminNurseSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  status: z.string(),
  licenseNumber: z.string().nullable(),
  specialization: z.string().nullable(),
  phone: z.string().nullable(),
  isAvailable: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const AdminNursesListResponseSchema = z.object({
  items: z.array(AdminNurseSchema),
  nextCursor: z.string().nullable().optional(),
});

export const AdminRequestItemSchema = z.object({
  id: z.string().uuid(),
  patientUserId: z.string().uuid(),
  assignedNurseUserId: z.string().uuid().nullable(),
  status: RequestStatusInfo,
  address: z.string(),
  lat: z.string(),
  lng: z.string(),
  assignedAt: z.string().datetime({ offset: true }).nullable(),
  acceptedAt: z.string().datetime({ offset: true }).nullable(),
  enrouteAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  canceledAt: z.string().datetime({ offset: true }).nullable(),
  rejectedAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const AdminRequestListResponseSchema = z.object({
  items: z.array(AdminRequestItemSchema),
  nextCursor: z.string().nullable().optional(),
});

export const AdminRequestDetailSchema = z.object({
  request: AdminRequestItemSchema,
  events: z.array(RequestEventSchema),
});

export type AdminRole = z.infer<typeof AdminRoleSchema>;
export type AdminListPagination = z.infer<typeof AdminListPaginationSchema>;
export type AdminUsersListQuery = z.infer<typeof AdminUsersListQuerySchema>;
export type AdminNursesListQuery = z.infer<typeof AdminNursesListQuerySchema>;
export type AdminRequestsListQuery = z.infer<typeof AdminRequestsListQuerySchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUsersListResponse = z.infer<typeof AdminUsersListResponseSchema>;
export type AdminNurse = z.infer<typeof AdminNurseSchema>;
export type AdminNursesListResponse = z.infer<typeof AdminNursesListResponseSchema>;
export type AdminRequestItem = z.infer<typeof AdminRequestItemSchema>;
export type AdminRequestListResponse = z.infer<typeof AdminRequestListResponseSchema>;
export type AdminRequestDetail = z.infer<typeof AdminRequestDetailSchema>;
