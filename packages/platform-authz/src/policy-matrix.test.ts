import { organizationId } from "@nurseconnect/contracts";
import { describe, expect, it } from "vitest";

import { authorizeTenantAction } from ".";
import type { AuthorizationInput, TenantSubject } from "./types";

const org1 = organizationId("11111111-1111-4111-8111-111111111111");
const org2 = organizationId("22222222-2222-4222-8222-222222222222");

const subject: TenantSubject = {
  userId: "user-1",
  personaRole: "admin",
  organizationId: org1,
  membershipRole: "owner",
  membershipStatus: "active",
};

function decision(overrides: Partial<AuthorizationInput>) {
  return authorizeTenantAction({
    subject,
    action: "tenant.read",
    resource: { kind: "organization", organizationId: org1 },
    context: { tenantId: org1 },
    ...overrides,
  });
}

function reason(overrides: Partial<AuthorizationInput>) {
  const result = decision(overrides);
  return result.allowed ? "allowed" : result.reason;
}

describe("authorizeTenantAction matrix coverage", () => {
  it("denies cross-tenant PHI before role or field evaluation", () => {
    expect(reason({
      action: "phi.read_field",
      resource: {
        kind: "patient_record",
        organizationId: org2,
        phiFields: ["clinical_note"],
      },
    })).toBe("cross_tenant");
  });

  it("denies unrestricted PHI fields for coordinator and owner", () => {
    expect(reason({
      subject: { ...subject, membershipRole: "coordinator" },
      action: "phi.read_field",
      resource: {
        kind: "patient_record",
        organizationId: org1,
        phiFields: ["clinical_note"],
      },
    })).toBe("phi_field_denied");
    expect(reason({
      action: "phi.read_field",
      resource: { kind: "patient_record", organizationId: org1, phiFields: ["address"] },
    })).toBe("phi_field_denied");
  });

  it("denies missing, mismatched, and empty facility scopes", () => {
    expect(reason({
      subject: { ...subject, facilityIds: ["facility-1"] },
      resource: { kind: "request", organizationId: org1 },
    })).toBe("scope_mismatch");
    expect(reason({
      subject: { ...subject, facilityIds: ["facility-1"] },
      resource: { kind: "request", organizationId: org1, facilityId: "facility-2" },
    })).toBe("scope_mismatch");
    expect(reason({
      subject: { ...subject, facilityIds: [] },
      resource: { kind: "request", organizationId: org1, facilityId: "facility-1" },
    })).toBe("scope_mismatch");
  });

  it("denies mismatched persona for tenant operations", () => {
    expect(reason({
      subject: { ...subject, personaRole: "patient" },
      action: "tenant.manage_members",
    })).toBe("action_denied");
  });

  it("binds actions to their resource kinds before allowing roles", () => {
    expect(reason({
      action: "request.read",
      resource: { kind: "patient_record", organizationId: org1 },
    })).toBe("action_denied");
    expect(reason({
      action: "phi.read_field",
      resource: { kind: "request", organizationId: org1, phiFields: ["schedule_window"] },
    })).toBe("action_denied");
    expect(reason({
      action: "assignment.participate",
      resource: { kind: "request", organizationId: org1 },
    })).toBe("action_denied");
  });

  it("enforces request ownership for requester reads", () => {
    const requester = {
      ...subject,
      userId: "patient-1",
      personaRole: "patient" as const,
      membershipRole: "requester" as const,
    };
    expect(decision({
      subject: requester,
      action: "request.read",
      resource: { kind: "request", organizationId: org1, ownerUserId: "patient-1" },
    }).allowed).toBe(true);
    expect(reason({
      subject: requester,
      action: "request.read",
      resource: { kind: "request", organizationId: org1, ownerUserId: "patient-2" },
    })).toBe("action_denied");
    expect(reason({
      subject: requester,
      action: "request.read",
      resource: { kind: "request", organizationId: org1 },
    })).toBe("action_denied");
  });

  it("enforces request assignment for nurse reads", () => {
    const nurse = {
      ...subject,
      userId: "nurse-1",
      personaRole: "nurse" as const,
      membershipRole: "coordinator" as const,
    };
    expect(decision({
      subject: nurse,
      action: "request.read",
      resource: { kind: "request", organizationId: org1, assignedNurseUserId: "nurse-1" },
    }).allowed).toBe(true);
    expect(reason({
      subject: nurse,
      action: "request.read",
      resource: { kind: "request", organizationId: org1, assignedNurseUserId: "nurse-2" },
    })).toBe("action_denied");
    expect(reason({
      subject: nurse,
      action: "request.read",
      resource: { kind: "request", organizationId: org1 },
    })).toBe("action_denied");
  });
});
