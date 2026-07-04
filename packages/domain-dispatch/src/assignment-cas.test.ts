import { serviceRequests } from "@nurseconnect/database/schema";
import { describe, expect, it, vi } from "vitest";

import { assignRequestToNurse } from "./assignment-policy";
import { reassignRequestInDispatch } from "./reassignment-policy";

const { appendRequestEvent } = vi.hoisted(() => ({
  appendRequestEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@nurseconnect/domain-request", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nurseconnect/domain-request")>()),
  appendRequestEvent,
}));

function makeRequest(overrides: Partial<typeof serviceRequests.$inferSelect> = {}) {
  const now = new Date("2026-04-16T00:00:00.000Z");
  return {
    id: "request-1",
    patientUserId: "patient-1",
    assignedNurseUserId: null,
    status: "open",
    address: "123 Main St",
    lat: "0.000000",
    lng: "0.000000",
    requestType: "same_day",
    scheduledFor: null,
    referralSource: "consumer",
    referralPartnerId: null,
    serviceAreaId: null,
    careType: null,
    assignedAt: null,
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
  } satisfies typeof serviceRequests.$inferSelect;
}

function staleUpdateTx(locked = makeRequest({ status: "assigned", assignedNurseUserId: "nurse-1" })) {
  return {
    execute: vi.fn().mockResolvedValue({
      rows: [{
        id: locked.id,
        status: locked.status,
        assignedNurseUserId: locked.assignedNurseUserId,
        assignedAt: locked.assignedAt,
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

describe("dispatch request status compare-and-set", () => {
  it("conflicts stale assignment writes before event emission", async () => {
    const tx = staleUpdateTx();

    await expect(assignRequestToNurse(tx as never, {
      request: makeRequest(),
      nurseUserId: "nurse-1",
      skipEligibilityValidation: true,
    })).rejects.toThrow("Request status changed during assignment");
    expect(appendRequestEvent).not.toHaveBeenCalled();
  });

  it("conflicts stale reassignment writes before event emission", async () => {
    const tx = staleUpdateTx();

    await expect(reassignRequestInDispatch(tx as never, {
      requestId: "request-1",
      actorUserId: "admin-1",
      nurseUserId: null,
    })).rejects.toThrow("Request status changed during reassignment");
    expect(appendRequestEvent).not.toHaveBeenCalled();
  });
});
