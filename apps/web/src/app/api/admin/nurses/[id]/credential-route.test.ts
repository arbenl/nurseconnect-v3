import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  credentialAuthorityForAdmin: vi.fn(),
  requireRole: vi.fn(),
  createApiLogContext: vi.fn(),
  logApiFailure: vi.fn(),
  logApiStart: vi.fn(),
  logApiSuccess: vi.fn(),
  withRequestId: vi.fn((response: Response) => response),
}));

vi.mock("@/server/admin/nurse-credential-authz", () => ({
  credentialAuthorityForAdmin: mocks.credentialAuthorityForAdmin,
}));

vi.mock("@/server/auth", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/server/telemetry/ops-logger", () => ({
  createApiLogContext: mocks.createApiLogContext,
  logApiFailure: mocks.logApiFailure,
  logApiStart: mocks.logApiStart,
  logApiSuccess: mocks.logApiSuccess,
  withRequestId: mocks.withRequestId,
}));

import { handleCredentialRoute } from "./credential-route";

const props = { params: Promise.resolve({ id: "nurse-1" }) };
const schema = {
  safeParse: vi.fn((data: unknown): { success: true; data: unknown } | { success: false; error: Error } => ({
    success: true,
    data,
  })),
};

function request(body: unknown = { reason: "Credential issue" }) {
  return new Request("https://app.test/api/admin/nurses/nurse-1/reject", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function namedError(name: string, message = name) {
  const error = new Error(message);
  error.name = name;
  return error;
}

describe("handleCredentialRoute", () => {
  beforeEach(() => {
    schema.safeParse.mockClear();
    mocks.credentialAuthorityForAdmin.mockReset();
    mocks.requireRole.mockReset();
    mocks.createApiLogContext.mockReset();
    mocks.logApiFailure.mockReset();
    mocks.logApiStart.mockReset();
    mocks.logApiSuccess.mockReset();
    mocks.withRequestId.mockClear();
    mocks.requireRole.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    mocks.credentialAuthorityForAdmin.mockResolvedValue({ organizationId: "org-1", policyDecision: { allowed: true } });
    mocks.createApiLogContext.mockReturnValue({ requestId: "req-1", path: "/api/admin/nurses/nurse-1/reject" });
  });

  it("returns the credential mutation result", async () => {
    const mutate = vi.fn().mockResolvedValue({ id: "nurse-1", status: "rejected" });

    const response = await handleCredentialRoute(request(), props, { action: "reject", schema, mutate });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, status: "rejected" });
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "admin-1",
      nurseId: "nurse-1",
      data: { reason: "Credential issue" },
    }));
    expect(mocks.logApiSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "admin-1", actorRole: "admin" }),
      200,
      expect.any(Number),
      { source: "admin.nurses.reject" },
    );
  });

  it("maps validation and missing nurse responses", async () => {
    schema.safeParse.mockReturnValueOnce({ success: false, error: new Error("bad body") });
    const invalid = await handleCredentialRoute(request(), props, {
      action: "reject",
      schema,
      mutate: vi.fn(),
    });
    expect(invalid.status).toBe(400);

    const missing = await handleCredentialRoute(request(), props, {
      action: "reject",
      schema,
      mutate: vi.fn().mockResolvedValue(null),
    });
    expect(missing.status).toBe(404);
  });

  it("maps known auth and credential errors", async () => {
    for (const [name, status] of [
      ["NurseCredentialValidationError", 400],
      ["NurseCredentialConflictError", 409],
      ["UnauthorizedError", 401],
      ["ForbiddenError", 403],
      ["UnexpectedError", 500],
    ] as const) {
      const response = await handleCredentialRoute(request(), props, {
        action: "reject",
        schema,
        mutate: vi.fn().mockRejectedValue(namedError(name)),
      });
      expect(response.status).toBe(status);
    }
  });
});
