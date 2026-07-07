import { serviceRequests } from "@nurseconnect/database/schema";
import { describe, expect, it, vi } from "vitest";

import { RequestConflictError } from "./errors";
import { applyAdminTriageAction, applyRequestAction } from "./request-actions";

const { appendRequestEvent } = vi.hoisted(() => ({
  appendRequestEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./request-events", () => ({
  appendRequestEvent,
}));

function makeRequestRow(
  overrides: Partial<typeof serviceRequests.$inferSelect> = {},
): typeof serviceRequests.$inferSelect {
  const now = new Date("2026-04-16T00:00:00.000Z");
  return {
    id: "request-1",
    patientUserId: "patient-1",
    assignedNurseUserId: "nurse-1",
    organizationId: null,
    branchId: null,
    status: "assigned",
    address: "123 Main St",
    lat: "0.000000",
    lng: "0.000000",
    requestType: "same_day",
    scheduledFor: null,
    referralSource: "consumer",
    referralPartnerId: null,
    serviceAreaId: null,
    careType: null,
    assignedAt: now,
    acceptedAt: null,
    enrouteAt: null,
    completedAt: null,
    canceledAt: null,
    rejectedAt: null,
    needsReviewAt: null,
    declinedAt: null,
    unfulfilledAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeStaleTx() {
  const lockedRequest = makeRequestRow();
  return {
    execute: vi.fn().mockResolvedValue({
      rows: [{
        id: lockedRequest.id,
        status: lockedRequest.status,
        patient_user_id: lockedRequest.patientUserId,
        assigned_nurse_user_id: lockedRequest.assignedNurseUserId,
        assigned_at: lockedRequest.assignedAt,
      }],
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  };
}

describe("request action compare-and-set", () => {
  it("returns deterministic conflict when authorized status proof is stale", async () => {
    const tx = makeStaleTx();

    await expect(
      applyRequestAction(tx as unknown as Parameters<typeof applyRequestAction>[0], {
        requestId: "request-1",
        actorUserId: "nurse-1",
        action: "accept",
        actorHasNurseProfile: true,
      }),
    ).rejects.toThrow(RequestConflictError);

    await expect(
      applyRequestAction(tx as unknown as Parameters<typeof applyRequestAction>[0], {
        requestId: "request-1",
        actorUserId: "nurse-1",
        action: "accept",
        actorHasNurseProfile: true,
      }),
    ).rejects.toThrow("Request status changed while applying transition");
    expect(appendRequestEvent).not.toHaveBeenCalled();
  });

  it("returns deterministic conflict when admin triage proof is stale", async () => {
    const tx = makeStaleTx();

    await expect(
      applyAdminTriageAction(tx as unknown as Parameters<typeof applyAdminTriageAction>[0], {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "needs_review",
      }),
    ).rejects.toThrow("Request status changed while applying transition");
    expect(appendRequestEvent).not.toHaveBeenCalled();
  });
});
