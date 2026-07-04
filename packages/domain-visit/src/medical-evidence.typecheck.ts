import { organizationId } from "@nurseconnect/contracts";

import { type MedicalEvidence, medicalEvidenceFor } from "./medical-evidence";

const rawMedicalEvidence = {
  organizationId: organizationId("11111111-1111-4111-8111-111111111111"),
  requestId: "request-1",
  actorUserId: "actor-1",
  actorRole: "nurse" as const,
  purpose: "visit_summary" as const,
};

// @ts-expect-error raw construction needs the medicalEvidenceFor constructor.
const typedMedicalEvidence: MedicalEvidence = rawMedicalEvidence;

const rawPolicyDecision = { allowed: true };

medicalEvidenceFor({
  organizationId: organizationId("11111111-1111-4111-8111-111111111111"),
  requestId: "request-1",
  actorUserId: "actor-1",
  actorRole: "nurse",
  // @ts-expect-error constructor requires a branded PolicyDecision.
  policyDecision: rawPolicyDecision,
  purpose: "visit_summary",
});
