import { organizationId } from "@nurseconnect/contracts";
import { authorizeTenantAction } from "@nurseconnect/platform-authz";
import { describe, expect, it } from "vitest";

import {
  canRejectCredential,
  canVerifyCredential,
  credentialStatusUpdate,
  type VerifiedCredentialEvidence,
} from "./credential-evidence";
import { NurseCredentialValidationError } from "./errors";

const org = organizationId("11111111-1111-4111-8111-111111111111");
const policyDecision = (membershipStatus: "active" | "disabled" = "active") =>
  authorizeTenantAction({
    subject: { userId: "actor-1", personaRole: "admin", organizationId: org, membershipRole: "admin", membershipStatus },
    action: "tenant.write",
    resource: { kind: "organization", organizationId: org },
    context: { tenantId: org },
  });
const context = {
  organizationId: org,
  nurseId: "nurse-1",
  actorUserId: "actor-1",
  policyDecision: policyDecision(),
};

describe("credential evidence", () => {
  it("binds status updates to credential proof context", () => {
    const evidence = canVerifyCredential("submitted", context);
    const update = credentialStatusUpdate(evidence, {
      ...context,
      fromStatus: "submitted",
      toStatus: "verified",
      action: "verify",
    });

    expect(update).toMatchObject({ status: "verified" });
    expect(Object.isFrozen(update)).toBe(true);
  });

  it("rejects unsupported transitions and denied policy decisions", () => {
    expect(() => canVerifyCredential("verified", context)).toThrow(NurseCredentialValidationError);
    expect(() => canRejectCredential("submitted", {
      ...context,
      policyDecision: policyDecision("disabled"),
    })).toThrow("Authorization denied");
  });

  it("rejects forged or mismatched proof objects", () => {
    const evidence = canVerifyCredential("submitted", context);
    const expected = { ...context, fromStatus: "submitted" as const, action: "verify" as const };

    expect(() => credentialStatusUpdate({ ...evidence } as VerifiedCredentialEvidence, expected))
      .toThrow("proof is not valid");
    expect(() => credentialStatusUpdate(JSON.parse(JSON.stringify(evidence)), expected))
      .toThrow("proof is not valid");
    expect(() => credentialStatusUpdate(evidence, { ...expected, nurseId: "nurse-2" }))
      .toThrow("proof does not match");
  });
});
