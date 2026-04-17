import { z } from "zod";

import { RequestStatusInfo } from "./requests";

export const PatientVisitSummarySchema = z.object({
  id: z.string().uuid(),
  status: RequestStatusInfo,
  address: z.string(),
  assignedNurseUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  requestType: z.enum(["scheduled", "same_day"]),
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  careType: z.string().nullable(),
});

export type PatientVisitSummary = z.infer<typeof PatientVisitSummarySchema>;

export const GetPatientVisitsResponseSchema = z.array(PatientVisitSummarySchema);
export type GetPatientVisitsResponse = z.infer<typeof GetPatientVisitsResponseSchema>;

export const NurseVisitSummarySchema = z.object({
  id: z.string().uuid(),
  address: z.string(),
  status: RequestStatusInfo,
  createdAt: z.string().datetime({ offset: true }),
  requestType: z.enum(["scheduled", "same_day"]),
  scheduledFor: z.string().datetime({ offset: true }).nullable(),
  careType: z.string().nullable(),
});

export type NurseVisitSummary = z.infer<typeof NurseVisitSummarySchema>;

export const NurseVisitFeedResponseSchema = z.object({
  activeAssignment: NurseVisitSummarySchema.nullable(),
  recentAssignments: z.array(NurseVisitSummarySchema),
});

export type NurseVisitFeedResponse = z.infer<typeof NurseVisitFeedResponseSchema>;
