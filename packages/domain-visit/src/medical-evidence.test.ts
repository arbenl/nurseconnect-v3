import { organizationId } from "@nurseconnect/contracts";
import { authorizeTenantAction } from "@nurseconnect/platform-authz";
import { describe, expect, it } from "vitest";

import { assertMedicalEvidence, medicalEvidenceFor, type MedicalEvidence } from "./medical-evidence";

const org = organizationId("11111111-1111-4111-8111-111111111111");
const policyDecision = (membershipStatus: "active" | "disabled" = "active") =>
  authorizeTenantAction({
    subject: { userId: "actor-1", personaRole: "nurse", organizationId: org, membershipRole: "coordinator", membershipStatus },
    action: "request.update",
    resource: { kind: "request", organizationId: org, assignedNurseUserId: "actor-1" },
    context: { tenantId: org },
  });
const context = {
  organizationId: org,
  requestId: "request-1",
  actorUserId: "actor-1",
  actorRole: "nurse" as const,
  policyDecision: policyDecision(),
  purpose: "visit_summary" as const,
};

describe("medical evidence", () => {
  it("binds medical evidence to visit write context", () => {
    const evidence = medicalEvidenceFor(context);

    expect(Object.isFrozen(evidence)).toBe(true);
    expect(() => assertMedicalEvidence(evidence, {
      organizationId: context.organizationId,
      requestId: context.requestId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      purpose: context.purpose,
    })).not.toThrow();
  });

  it("rejects denied, forged, or mismatched evidence", () => {
    expect(() => medicalEvidenceFor({
      ...context,
      policyDecision: policyDecision("disabled"),
    })).toThrow("Authorization denied");

    const evidence = medicalEvidenceFor(context);
    expect(() => assertMedicalEvidence({ ...evidence } as MedicalEvidence, evidence))
      .toThrow("proof is not valid");
    expect(() => assertMedicalEvidence(evidence, { ...evidence, requestId: "request-2" }))
      .toThrow("proof does not match");
  });
});
