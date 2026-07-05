import { brandValue, type Brand, type OrganizationId } from "@nurseconnect/contracts";
import { assertTenantActionAllowed, type PolicyDecision } from "@nurseconnect/platform-authz";

export type MedicalEvidencePurpose = "visit_summary";
export type MedicalEvidenceContext = {
  organizationId: OrganizationId;
  requestId: string;
  actorUserId: string;
  actorRole: "admin" | "nurse";
  policyDecision: PolicyDecision;
  purpose: MedicalEvidencePurpose;
};
type MedicalEvidenceShape = {
  organizationId: OrganizationId;
  requestId: string;
  actorUserId: string;
  actorRole: "admin" | "nurse";
  purpose: MedicalEvidencePurpose;
};
export type MedicalEvidence = Readonly<Brand<MedicalEvidenceShape, "MedicalEvidence">>;

const medicalEvidence = new WeakSet<object>();

export function medicalEvidenceFor(context: MedicalEvidenceContext): MedicalEvidence {
  assertTenantActionAllowed(context.policyDecision);
  const evidence = brandValue<MedicalEvidenceShape, "MedicalEvidence">({
    organizationId: context.organizationId,
    requestId: context.requestId,
    actorUserId: context.actorUserId,
    actorRole: context.actorRole,
    purpose: context.purpose,
  });
  medicalEvidence.add(evidence);
  return Object.freeze(evidence);
}

export function assertMedicalEvidence(
  evidence: MedicalEvidence,
  expected: MedicalEvidenceShape,
): void {
  if (!medicalEvidence.has(evidence)) {
    throw new Error("MedicalEvidence proof is not valid");
  }
  if (
    evidence.organizationId !== expected.organizationId ||
    evidence.requestId !== expected.requestId ||
    evidence.actorUserId !== expected.actorUserId ||
    evidence.actorRole !== expected.actorRole ||
    evidence.purpose !== expected.purpose
  ) {
    throw new Error("MedicalEvidence proof does not match persistence context");
  }
}
