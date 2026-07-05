import { organizationId } from "@nurseconnect/contracts";
import { db } from "@nurseconnect/database";
import { recordAdminAction } from "@nurseconnect/platform-telemetry/admin-audit";
import { authorizeTenantAction } from "@nurseconnect/platform-authz";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queue: [] as unknown[],
  rows: [{ id: "nurse-1" }],
  updates: [] as unknown[],
}));

vi.mock("@nurseconnect/database", () => {
  const builder = {
    set(update: unknown) {
      state.updates.push(update);
      return { where: () => ({ returning: () => Promise.resolve(state.rows) }) };
    },
  };
  return {
    and: vi.fn((...clauses: unknown[]) => clauses),
    db: { transaction: vi.fn((callback) => callback({ update: vi.fn(() => builder) })) },
    eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
    schema: { nurses: { id: "nurse.id", status: "nurse.status" }, users: { id: "user.id" } },
  };
});

vi.mock("@nurseconnect/platform-telemetry/admin-audit", () => ({
  recordAdminAction: vi.fn(),
}));

vi.mock("./credential-lifecycle", () => ({
  getNurseCredentialById: vi.fn(() => Promise.resolve(state.queue.shift() ?? null)),
}));

import {
  persistCredentialStatus,
  rejectNurseCredential,
  suspendNurseCredential,
  verifyNurseCredential,
} from "./credential-admin";
import { canVerifyCredential } from "./credential-evidence";
import { NurseCredentialConflictError, NurseCredentialValidationError } from "./errors";

const org = organizationId("11111111-1111-4111-8111-111111111111");
const submitted = {
  id: "nurse-1",
  userId: "user-1",
  status: "submitted" as const,
  licenseJurisdiction: "CA",
};

function authority(nurseId = "nurse-1") {
  return {
    actorUserId: "admin-1",
    nurseId,
    organizationId: org,
    policyDecision: authorizeTenantAction({
      subject: { userId: "admin-1", personaRole: "admin", organizationId: org, membershipRole: "admin", membershipStatus: "active" },
      action: "tenant.write",
      resource: { kind: "organization", organizationId: org },
      context: { tenantId: org },
    }),
  };
}

describe("credential admin", () => {
  beforeEach(() => {
    state.queue = [];
    state.rows = [{ id: "nurse-1" }];
    state.updates = [];
    vi.mocked(db.transaction).mockClear();
    vi.mocked(recordAdminAction).mockClear();
  });

  it("verifies a submitted nurse with credential proof, role update, and audit", async () => {
    state.queue = [submitted, { ...submitted, status: "verified" }];

    const result = await verifyNurseCredential({
      ...authority(),
      licenseValidUntil: "2027-12-31T00:00:00.000Z",
    });

    expect(result).toMatchObject({ status: "verified" });
    expect(state.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "verified", verifiedBy: "admin-1" }),
      expect.objectContaining({ role: "nurse" }),
    ]));
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "nurse.credential.verified" }),
      expect.any(Object),
    );
  });

  it("rejects and suspends credentials with audit evidence", async () => {
    state.queue = [submitted, { ...submitted, status: "rejected" }];
    await expect(rejectNurseCredential({ ...authority(), reason: "Incomplete" }))
      .resolves.toMatchObject({ status: "rejected" });

    state.queue = [{ ...submitted, status: "verified" }, { ...submitted, status: "suspended" }];
    await expect(suspendNurseCredential({ ...authority(), reason: "Expired license" }))
      .resolves.toMatchObject({ status: "suspended" });

    expect(state.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "rejected", isAvailable: false }),
      expect.objectContaining({ status: "suspended", suspensionReason: "Expired license" }),
    ]));
    expect(recordAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: "nurse.credential.suspended" }),
      expect.any(Object),
    );
  });

  it("handles missing nurses and invalid verification dates", async () => {
    state.queue = [null];
    await expect(rejectNurseCredential({ ...authority(), reason: "No profile" })).resolves.toBeNull();

    state.queue = [submitted];
    await expect(verifyNurseCredential({ ...authority(), licenseValidUntil: "not-a-date" }))
      .rejects.toBeInstanceOf(NurseCredentialValidationError);

    state.queue = [submitted];
    await expect(verifyNurseCredential({ ...authority(), licenseValidUntil: "2020-01-01T00:00:00.000Z" }))
      .rejects.toThrow("future");
  });

  it("turns stale compare-and-set writes into credential conflicts", async () => {
    state.rows = [];
    const evidence = canVerifyCredential("submitted", authority());

    await expect(
      db.transaction((tx) =>
        persistCredentialStatus(authority(), "submitted", "verify", evidence, {
          verifiedAt: new Date("2026-01-01T00:00:00.000Z"),
        }, tx),
      ),
    ).rejects.toBeInstanceOf(NurseCredentialConflictError);
  });
});
