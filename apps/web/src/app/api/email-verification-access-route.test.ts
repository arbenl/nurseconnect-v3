import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}

  return {
    UnauthorizedError,
    and: vi.fn(),
    authGetSession: vi.fn(),
    authErrorResponse: vi.fn(),
    assertEmailVerificationAccess: vi.fn(),
    buildMeUserProjection: vi.fn(),
    buildProfileUpdatePatch: vi.fn(),
    createApiLogContext: vi.fn(),
    db: {
      query: { serviceRequests: { findFirst: vi.fn() } },
      update: vi.fn(),
    },
    ensureDomainUserFromSession: vi.fn(),
    eq: vi.fn(),
    getNurseByUserId: vi.fn(),
    getSession: vi.fn(),
    headers: vi.fn(),
    logApiFailure: vi.fn(),
    logApiStart: vi.fn(),
    logApiSuccess: vi.fn(),
    maybeBootstrapFirstAdmin: vi.fn(),
    or: vi.fn(),
    resolveCurrentSessionUser: vi.fn(),
    schema: {
      serviceRequests: {
        assignedNurseUserId: "assignedNurseUserId",
        status: "status",
      },
      users: {
        authId: "authId",
      },
    },
    setMyAvailability: vi.fn(),
    submitOwnNurseApplication: vi.fn(),
    withRequestId: vi.fn((response: Response) => response),
  };
});

vi.mock("@nurseconnect/database", () => ({
  and: mocks.and,
  db: mocks.db,
  eq: mocks.eq,
  or: mocks.or,
  schema: mocks.schema,
}));

vi.mock("@nurseconnect/domain-identity", () => ({
  buildMeUserProjection: mocks.buildMeUserProjection,
  buildProfileUpdatePatch: mocks.buildProfileUpdatePatch,
  ensureDomainUserFromSession: mocks.ensureDomainUserFromSession,
  maybeBootstrapFirstAdmin: mocks.maybeBootstrapFirstAdmin,
  ProfileValidationError: class ProfileValidationError extends Error {},
}));

vi.mock("@nurseconnect/domain-nurse", () => ({
  NurseAvailabilityError: class NurseAvailabilityError extends Error {},
  NurseCredentialValidationError: class NurseCredentialValidationError extends Error {},
  NurseProfileNotFoundError: class NurseProfileNotFoundError extends Error {},
  setMyAvailability: mocks.setMyAvailability,
  submitOwnNurseApplication: mocks.submitOwnNurseApplication,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: mocks.authGetSession,
    },
  },
}));

vi.mock("@/lib/nurse-record", () => ({
  getNurseByUserId: mocks.getNurseByUserId,
}));

vi.mock("@/server/auth", () => ({
  UnauthorizedError: mocks.UnauthorizedError,
  assertEmailVerificationAccess: mocks.assertEmailVerificationAccess,
  authErrorResponse: mocks.authErrorResponse,
  getSession: mocks.getSession,
  resolveCurrentSessionUser: mocks.resolveCurrentSessionUser,
}));

vi.mock("@/server/telemetry/ops-logger", () => ({
  createApiLogContext: mocks.createApiLogContext,
  logApiFailure: mocks.logApiFailure,
  logApiStart: mocks.logApiStart,
  logApiSuccess: mocks.logApiSuccess,
  withRequestId: mocks.withRequestId,
}));

import { POST as postBecomeNurse } from "./me/become-nurse/route";
import { PATCH as patchNurse } from "./me/nurse/route";
import { PATCH as patchMeProfile } from "./me/profile/route";
import { GET as getMe } from "./me/route";
import { GET as getLegacyProfile } from "./profile/route";

const session = {
  user: {
    id: "auth-user-1",
    email: "nurse@example.test",
    name: "Nurse Example",
  },
};

function unauthorizedResponse() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

describe("email verification access routes", () => {
  beforeEach(() => {
    mocks.assertEmailVerificationAccess.mockReset();
    mocks.authErrorResponse.mockReset();
    mocks.authGetSession.mockReset();
    mocks.createApiLogContext.mockReset();
    mocks.getSession.mockReset();
    mocks.headers.mockReset();
    mocks.logApiFailure.mockReset();
    mocks.logApiStart.mockReset();
    mocks.logApiSuccess.mockReset();
    mocks.resolveCurrentSessionUser.mockReset();
    mocks.withRequestId.mockClear();

    mocks.createApiLogContext.mockReturnValue({
      requestId: "req-verify",
      path: "/api/test",
    });
    mocks.getSession.mockResolvedValue(session);
    mocks.authGetSession.mockResolvedValue(session);
    mocks.headers.mockResolvedValue(new Headers());
    mocks.authErrorResponse.mockReturnValue(unauthorizedResponse());
    mocks.resolveCurrentSessionUser.mockResolvedValue(null);
    mocks.assertEmailVerificationAccess.mockRejectedValue(
      new mocks.UnauthorizedError("Email verification required"),
    );
  });

  it("blocks /api/me when the current session cannot pass email verification", async () => {
    const response = await getMe(new Request("https://app.test/api/me"));

    expect(response.status).toBe(401);
    expect(mocks.assertEmailVerificationAccess).toHaveBeenCalledWith(session, "/api/me");
    expect(mocks.authErrorResponse).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ actorId: "auth-user-1" }),
      expect.any(Number),
      "api.me",
    );
  });

  it("blocks /api/me/profile mutations before reading the request body", async () => {
    const response = await patchMeProfile(
      new Request("https://app.test/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName: "Ada" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.resolveCurrentSessionUser).toHaveBeenCalled();
    expect(mocks.buildProfileUpdatePatch).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.assertEmailVerificationAccess).not.toHaveBeenCalled();
  });

  it("blocks /api/me/nurse mutations before availability changes", async () => {
    const response = await patchNurse(
      new Request("https://app.test/api/me/nurse", {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: true }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.assertEmailVerificationAccess).toHaveBeenCalledWith(
      session,
      "/api/me/nurse",
    );
    expect(mocks.setMyAvailability).not.toHaveBeenCalled();
  });

  it("blocks /api/me/become-nurse before self-service nurse application writes", async () => {
    const response = await postBecomeNurse(
      new Request("https://app.test/api/me/become-nurse", {
        method: "POST",
        body: JSON.stringify({
          licenseNumber: "RN-123",
          licenseJurisdiction: "NY",
          specialization: "Pediatrics",
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.assertEmailVerificationAccess).toHaveBeenCalledWith(
      session,
      "/api/me/become-nurse",
    );
    expect(mocks.submitOwnNurseApplication).not.toHaveBeenCalled();
  });

  it("blocks the legacy /api/profile adapter for unverified sessions", async () => {
    const response = await getLegacyProfile(
      new Request("https://app.test/api/profile") as never,
    );

    expect(response.status).toBe(401);
    expect(mocks.assertEmailVerificationAccess).toHaveBeenCalledWith(
      session,
      "/api/profile",
    );
  });
});
