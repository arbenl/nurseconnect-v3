import { serviceRequests } from "@nurseconnect/database/schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestForbiddenError } from "./errors";
import {
  applyAdminTriageAction,
  applyRequestAction,
  type RequestSideEffect,
} from "./request-actions";

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

function makeTx(
  updatedRequest = makeRequestRow(),
  lockedRequest = makeRequestRow(),
) {
  return {
    execute: vi.fn().mockResolvedValue({
      rows: [
        {
          id: lockedRequest.id,
          status: lockedRequest.status,
          patient_user_id: lockedRequest.patientUserId,
          assigned_nurse_user_id: lockedRequest.assignedNurseUserId,
          assigned_at: lockedRequest.assignedAt,
        },
      ],
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedRequest]),
        }),
      }),
    }),
  };
}

describe("applyRequestAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns nurse availability side effects for reject without empty event meta", async () => {
    const updatedRequest = makeRequestRow({
      status: "open",
      assignedNurseUserId: null,
      rejectedAt: new Date("2026-04-16T00:05:00.000Z"),
    });
    const tx = makeTx(updatedRequest, makeRequestRow());

    const result = await applyRequestAction(
      tx as unknown as Parameters<typeof applyRequestAction>[0],
      {
        requestId: "request-1",
        actorUserId: "nurse-1",
        action: "reject",
        actorHasNurseProfile: true,
      },
    );

    expect(result.sideEffects).toEqual<RequestSideEffect[]>([
      {
        type: "set-nurse-availability",
        userId: "nurse-1",
        isAvailable: true,
      },
    ]);
    expect(result.event).toMatchObject({
      type: "request_rejected",
      fromStatus: "assigned",
      toStatus: "open",
      meta: null,
    });
    expect(appendRequestEvent).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ meta: null }),
    );
  });

  it("requires the nurse-profile precondition for nurse actions", async () => {
    const tx = makeTx();

    await expect(
      applyRequestAction(tx as unknown as Parameters<typeof applyRequestAction>[0], {
        requestId: "request-1",
        actorUserId: "nurse-1",
        action: "accept",
        actorHasNurseProfile: false,
      }),
    ).rejects.toThrow(new RequestForbiddenError("Nurse profile is required"));

    expect(appendRequestEvent).not.toHaveBeenCalled();
  });
});

describe("applyAdminTriageAction", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("requires a reason when an admin marks a request unfulfilled", async () => {
    const tx = makeTx(makeRequestRow(), makeRequestRow({ status: "open", assignedNurseUserId: null }));

    await expect(
      applyAdminTriageAction(tx as unknown as Parameters<typeof applyAdminTriageAction>[0], {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "unfulfilled",
      }),
    ).rejects.toThrow("Reason is required");

    expect(appendRequestEvent).not.toHaveBeenCalled();
  });

  it("enforces terminal reason length in the domain layer", async () => {
    const tx = makeTx(makeRequestRow(), makeRequestRow({ status: "open", assignedNurseUserId: null }));

    await expect(
      applyAdminTriageAction(tx as unknown as Parameters<typeof applyAdminTriageAction>[0], {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "decline",
        reason: "no",
      }),
    ).rejects.toThrow("Reason must be between 3 and 1000 characters");

    expect(appendRequestEvent).not.toHaveBeenCalled();
  });

  it("unassigns and frees a nurse when an admin pulls an assigned request into review", async () => {
    const updatedRequest = makeRequestRow({
      status: "needs_review",
      assignedNurseUserId: null,
      needsReviewAt: new Date("2026-04-16T00:05:00.000Z"),
    });
    const tx = makeTx(updatedRequest, makeRequestRow({ status: "assigned", assignedNurseUserId: "nurse-1" }));

    const result = await applyAdminTriageAction(
      tx as unknown as Parameters<typeof applyAdminTriageAction>[0],
      {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "needs_review",
        reason: "Needs operator review",
      },
    );

    expect(result.sideEffects).toEqual<RequestSideEffect[]>([
      {
        type: "set-nurse-availability",
        userId: "nurse-1",
        isAvailable: true,
      },
    ]);
    expect(result.event).toMatchObject({
      type: "request_needs_review",
      actorUserId: "admin-1",
      fromStatus: "assigned",
      toStatus: "needs_review",
      meta: { reason: "Needs operator review" },
    });
  });

  it("unassigns and frees a nurse when an admin declines an assigned request directly", async () => {
    const updatedRequest = makeRequestRow({
      status: "declined",
      assignedNurseUserId: null,
      declinedAt: new Date("2026-04-16T00:05:00.000Z"),
    });
    const tx = makeTx(updatedRequest, makeRequestRow({ status: "assigned", assignedNurseUserId: "nurse-1" }));

    const result = await applyAdminTriageAction(
      tx as unknown as Parameters<typeof applyAdminTriageAction>[0],
      {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "decline",
        reason: "Outside clinical scope",
      },
    );

    expect(result.sideEffects).toEqual<RequestSideEffect[]>([
      {
        type: "set-nurse-availability",
        userId: "nurse-1",
        isAvailable: true,
      },
    ]);
    expect(result.event).toMatchObject({
      type: "request_declined",
      fromStatus: "assigned",
      toStatus: "declined",
      meta: { reason: "Outside clinical scope" },
    });
  });

  it("unassigns and frees a nurse when an admin marks an assigned request unfulfilled", async () => {
    const updatedRequest = makeRequestRow({
      status: "unfulfilled",
      assignedNurseUserId: null,
      unfulfilledAt: new Date("2026-04-16T00:05:00.000Z"),
    });
    const tx = makeTx(updatedRequest, makeRequestRow({ status: "assigned", assignedNurseUserId: "nurse-1" }));

    const result = await applyAdminTriageAction(
      tx as unknown as Parameters<typeof applyAdminTriageAction>[0],
      {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "unfulfilled",
        reason: "No nurse capacity",
      },
    );

    expect(result.sideEffects).toEqual<RequestSideEffect[]>([
      {
        type: "set-nurse-availability",
        userId: "nurse-1",
        isAvailable: true,
      },
    ]);
    expect(result.event).toMatchObject({
      type: "request_unfulfilled",
      fromStatus: "assigned",
      toStatus: "unfulfilled",
      meta: { reason: "No nurse capacity" },
    });
  });

  it("reopens exception requests without carrying stale assignment or timestamps", async () => {
    const updatedRequest = makeRequestRow({
      status: "open",
      assignedNurseUserId: null,
      assignedAt: null,
      needsReviewAt: null,
      declinedAt: null,
      unfulfilledAt: null,
    });
    const tx = makeTx(updatedRequest, makeRequestRow({ status: "declined", assignedNurseUserId: "nurse-1" }));

    const result = await applyAdminTriageAction(
      tx as unknown as Parameters<typeof applyAdminTriageAction>[0],
      {
        requestId: "request-1",
        actorUserId: "admin-1",
        action: "reopen",
      },
    );

    expect(result.sideEffects).toEqual([]);
    expect(result.event).toMatchObject({
      type: "request_reopened",
      fromStatus: "declined",
      toStatus: "open",
      meta: null,
    });
  });
});
