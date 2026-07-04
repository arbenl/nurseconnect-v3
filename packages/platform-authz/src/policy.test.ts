import { organizationId } from "@nurseconnect/contracts";
import { describe, expect, it } from "vitest";

import { assertTenantActionAllowed, authorizeTenantAction } from ".";
import type { AuthorizationInput, PolicyDecision, TenantSubject } from ".";

const org1 = organizationId("11111111-1111-4111-8111-111111111111");
const org2 = organizationId("22222222-2222-4222-8222-222222222222");

const subject: TenantSubject = {
  userId: "user-1",
  personaRole: "admin",
  organizationId: org1,
  membershipRole: "owner",
  membershipStatus: "active",
};

function input(overrides: Partial<AuthorizationInput> = {}): AuthorizationInput {
  return {
    subject,
    action: "tenant.read",
    resource: { kind: "organization", organizationId: org1 },
    context: { tenantId: org1 },
    ...overrides,
  };
}

function denyReason(overrides: Partial<AuthorizationInput>) {
  const decision = authorizeTenantAction(input(overrides));
  return decision.allowed ? "allowed" : decision.reason;
}

describe("authorizeTenantAction", () => {
  it("allows tenant owner, admin, coordinator, requester, and viewer basics", () => {
    expect(authorizeTenantAction(input({ action: "tenant.manage_members" })).allowed).toBe(true);
    expect(authorizeTenantAction(input({
      subject: { ...subject, membershipRole: "admin" },
      action: "tenant.write",
    })).allowed).toBe(true);
    expect(authorizeTenantAction(input({
      subject: { ...subject, membershipRole: "coordinator" },
      action: "assignment.participate",
      resource: { kind: "assignment", organizationId: org1 },
    })).allowed).toBe(true);
    expect(authorizeTenantAction(input({
      subject: { ...subject, membershipRole: "requester" },
      action: "request.create",
      resource: { kind: "request", organizationId: org1 },
    })).allowed).toBe(true);
    expect(authorizeTenantAction(input({
      subject: { ...subject, membershipRole: "viewer" },
      action: "request.read",
      resource: { kind: "request", organizationId: org1 },
    })).allowed).toBe(true);
  });

  it("denies with deterministic safe reason precedence", () => {
    expect(denyReason({ subject: null })).toBe("missing_subject");
    expect(denyReason({
      subject: { ...subject, membershipStatus: "invited" },
      resource: { kind: "request", organizationId: org2 },
      context: { tenantId: org2 },
    })).toBe("inactive_membership");
    expect(denyReason({ resource: { kind: "request", organizationId: null } })).toBe("missing_tenant");
    expect(denyReason({ resource: { kind: "request", organizationId: org2 } })).toBe("cross_tenant");
  });

  it("does not let global admin persona bypass active membership", () => {
    expect(denyReason({
      subject: {
        ...subject,
        personaRole: "admin",
        membershipRole: "viewer",
        membershipStatus: "disabled",
      },
      action: "tenant.manage_members",
    })).toBe("inactive_membership");
  });

  it("distinguishes omitted branch scope from explicitly empty scope", () => {
    expect(authorizeTenantAction(input({
      action: "request.read",
      resource: { kind: "request", organizationId: org1, branchId: "branch-1" },
    })).allowed).toBe(true);
    expect(denyReason({
      subject: { ...subject, branchIds: ["branch-1"] },
      action: "request.read",
      resource: { kind: "request", organizationId: org1 },
    })).toBe("scope_mismatch");
    expect(denyReason({
      subject: { ...subject, branchIds: [] },
      action: "request.read",
      resource: { kind: "request", organizationId: org1, branchId: "branch-1" },
    })).toBe("scope_mismatch");
  });

  it("denies wrong roles, mutation by viewer, and disallowed PHI fields", () => {
    expect(denyReason({
      subject: { ...subject, membershipRole: "requester" },
      action: "tenant.manage_members",
    })).toBe("action_denied");
    expect(denyReason({
      subject: { ...subject, membershipRole: "viewer" },
      action: "request.update",
    })).toBe("action_denied");
    expect(denyReason({
      action: "phi.read_field",
      resource: { kind: "patient_record", organizationId: org1, phiFields: ["address"] },
    })).toBe("phi_field_denied");
    expect(denyReason({
      subject: { ...subject, membershipRole: "coordinator" },
      action: "phi.read_field",
      resource: { kind: "patient_record", organizationId: org1 },
    })).toBe("phi_field_denied");
    expect(denyReason({
      subject: { ...subject, membershipRole: "coordinator" },
      action: "phi.read_field",
      resource: { kind: "patient_record", organizationId: org1, phiFields: [] },
    })).toBe("phi_field_denied");
  });

  it("allows coordinator minimum-necessary synthetic PHI fields", () => {
    expect(authorizeTenantAction(input({
      subject: { ...subject, membershipRole: "coordinator" },
      action: "phi.read_field",
      resource: {
        kind: "patient_record",
        organizationId: org1,
        phiFields: ["schedule_window", "mobility_need"],
      },
    })).allowed).toBe(true);
  });

  it("throws package-owned errors from assert helper", () => {
    expect(() => assertTenantActionAllowed(authorizeTenantAction(input({
      subject: { ...subject, membershipRole: "viewer" },
      action: "tenant.write",
    })))).toThrow("Authorization denied: action_denied");
  });

  it("rejects forged policy decisions", () => {
    expect(() => assertTenantActionAllowed({ allowed: true } as PolicyDecision))
      .toThrow("Authorization denied: action_denied");
  });
});
