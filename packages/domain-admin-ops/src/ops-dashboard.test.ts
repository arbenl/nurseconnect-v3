import type {
  AdminActiveRequestQueueItem,
  AdminOpsStatusCounts,
  AdminReassignmentActivityItem,
} from "@nurseconnect/contracts";
import { describe, expect, it } from "vitest";

import { summarizeOpsDashboard } from "./ops-dashboard";

const queueItems: AdminActiveRequestQueueItem[] = [
  {
    requestId: "11111111-1111-1111-1111-111111111111",
    status: "open",
    requestType: "same_day",
    referralSource: "consumer",
    partnerLabel: null,
    careType: null,
    severityScore: 91,
    severityBand: "critical",
    waitMinutes: 60,
    lastEventAt: "2026-03-01T10:00:00.000Z",
    createdAt: "2026-03-01T09:00:00.000Z",
    assignedNurse: "unassigned",
    locationHint: "~42.66,21.17",
  },
  {
    requestId: "22222222-2222-2222-2222-222222222222",
    status: "assigned",
    requestType: "same_day",
    referralSource: "consumer",
    partnerLabel: null,
    careType: "Home Care",
    severityScore: 72,
    severityBand: "high",
    waitMinutes: 30,
    lastEventAt: "2026-03-01T10:10:00.000Z",
    createdAt: "2026-03-01T09:30:00.000Z",
    assignedNurse: "assigned",
    locationHint: "~42.60,21.10",
  },
  {
    requestId: "33333333-3333-3333-3333-333333333333",
    status: "assigned",
    requestType: "scheduled",
    referralSource: "partner",
    partnerLabel: "City Clinic",
    careType: null,
    severityScore: 51,
    severityBand: "medium",
    waitMinutes: 10,
    lastEventAt: "2026-03-01T10:20:00.000Z",
    createdAt: "2026-03-01T09:50:00.000Z",
    assignedNurse: "assigned",
    locationHint: "~42.61,21.11",
  },
  {
    requestId: "44444444-4444-4444-4444-444444444444",
    status: "open",
    requestType: "same_day",
    referralSource: "consumer",
    partnerLabel: null,
    careType: null,
    severityScore: 40,
    severityBand: "medium",
    waitMinutes: 15,
    lastEventAt: "2026-03-01T10:05:00.000Z",
    createdAt: "2026-03-01T09:45:00.000Z",
    assignedNurse: "unassigned",
    locationHint: "~42.62,21.12",
  },
  {
    requestId: "55555555-5555-5555-5555-555555555555",
    status: "accepted",
    requestType: "same_day",
    referralSource: "consumer",
    partnerLabel: null,
    careType: null,
    severityScore: 39,
    severityBand: "medium",
    waitMinutes: 25,
    lastEventAt: "2026-03-01T10:15:00.000Z",
    createdAt: "2026-03-01T09:35:00.000Z",
    assignedNurse: "assigned",
    locationHint: "~42.63,21.13",
  },
  {
    requestId: "66666666-6666-6666-6666-666666666666",
    status: "enroute",
    requestType: "same_day",
    referralSource: "consumer",
    partnerLabel: null,
    careType: null,
    severityScore: 20,
    severityBand: "low",
    waitMinutes: 5,
    lastEventAt: "2026-03-01T10:25:00.000Z",
    createdAt: "2026-03-01T10:15:00.000Z",
    assignedNurse: "assigned",
    locationHint: "~42.64,21.14",
  },
];

const recentActivity: AdminReassignmentActivityItem[] = [
  {
    source: "request-event",
    id: 8,
    requestId: "11111111-1111-1111-1111-111111111111",
    actorUserId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    fromStatus: "open",
    toStatus: "assigned",
    metadata: {
      previousNurseUserId: null,
      newNurseUserId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    },
    createdAt: "2026-03-01T10:30:00.000Z",
  },
];

const opsStatus: AdminOpsStatusCounts = {
  generatedAt: "2026-03-01T10:35:00.000Z",
  serviceAreas: {
    active: 1,
  },
  nurseSupply: {
    verifiedAndAvailable: 3,
    launchMinimum: 10,
    launchShortfall: 7,
    launchReady: false,
    launchServiceAreaCount: 1,
    launchLowestServiceAreaSupply: 3,
    launchServiceAreasBelowMinimum: 1,
  },
  requests: {
    unassigned: 2,
    staleAssigned: 1,
    staleEnroute: 1,
    exceptionQueue: 2,
  },
  payments: {
    authorizationsWithoutPayout: 1,
    recentFailedAuthorizations: 1,
    recentFailedPayouts: 0,
  },
};

describe("summarizeOpsDashboard", () => {
  it("builds the existing request counts and slices the hottest five requests", () => {
    const summary = summarizeOpsDashboard({
      queueItems,
      credentialCounts: {
        total: 12,
        available: 5,
        needsAttention: 3,
        draft: 0,
        submitted: 1,
        under_review: 1,
        verified: 8,
        rejected: 0,
        suspended: 1,
        expired: 1,
        renewal_pending: 1,
      },
      pendingCredentialItems: [
        {
          id: "77777777-7777-7777-7777-777777777777",
          userId: "88888888-8888-8888-8888-888888888888",
          status: "submitted",
          licenseNumber: "RN-1",
          licenseJurisdiction: "XK",
          specialization: "General",
          licenseValidUntil: null,
          verifiedBy: null,
          verifiedAt: null,
          suspendedAt: null,
          suspensionReason: null,
          isAvailable: false,
          createdAt: new Date("2026-03-01T10:00:00.000Z"),
          updatedAt: new Date("2026-03-01T10:00:00.000Z"),
          userName: "Nurse One",
          userEmail: "nurse1@test.local",
          userRole: "nurse",
        },
      ],
      recentActivity,
      opsStatus,
      paymentFollowUpItems: [
        {
          kind: "authorization_failed",
          requestId: "99999999-9999-9999-9999-999999999999",
          createdAt: "2026-03-01T10:34:00.000Z",
        },
      ],
      generatedAt: "2026-03-01T10:35:00.000Z",
    });

    expect(summary.generatedAt).toBe("2026-03-01T10:35:00.000Z");
    expect(summary.requestCounts).toEqual({
      total: 6,
      critical: 1,
      high: 1,
      unassigned: 2,
      assigned: 4,
    });
    expect(summary.recentHotRequests).toHaveLength(5);
    expect(summary.recentHotRequests.map((item) => item.requestId)).toEqual([
      "11111111-1111-1111-1111-111111111111",
      "22222222-2222-2222-2222-222222222222",
      "33333333-3333-3333-3333-333333333333",
      "44444444-4444-4444-4444-444444444444",
      "55555555-5555-5555-5555-555555555555",
    ]);
    expect(summary.recentHotRequests[2]?.partnerLabel).toBe("City Clinic");
    expect(summary.recentActivity).toEqual(recentActivity);
    expect(summary.pendingCredentialItems).toHaveLength(1);
    expect(summary.opsStatus).toEqual({
      ...opsStatus,
      requests: {
        ...opsStatus.requests,
        unassigned: 2,
        staleEnroute: 0,
      },
    });
    expect(summary.paymentFollowUpItems).toEqual([
      {
        kind: "authorization_failed",
        requestId: "99999999-9999-9999-9999-999999999999",
        createdAt: "2026-03-01T10:34:00.000Z",
      },
    ]);
  });
});
