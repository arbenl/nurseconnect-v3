import { serviceRequests } from "@nurseconnect/database/schema";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RequestForbiddenError } from "./errors";
import { applyRequestAction, type RequestSideEffect } from "./request-actions";

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
    careType: null,
    assignedAt: now,
    acceptedAt: null,
    enrouteAt: null,
    completedAt: null,
    canceledAt: null,
    rejectedAt: null,
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
