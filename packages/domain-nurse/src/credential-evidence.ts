import { brandValue, type Brand, type NurseStatus, type OrganizationId } from "@nurseconnect/contracts";
import { nurses } from "@nurseconnect/database/schema";
import { assertTenantActionAllowed, type PolicyDecision } from "@nurseconnect/platform-authz";

import { NurseCredentialValidationError } from "./errors";

type CredentialAction = "verify" | "reject" | "suspend";
type CredentialStatusUpdateExtras = Omit<Partial<typeof nurses.$inferInsert>, "status">;
type CredentialEvidenceShape = {
  organizationId: OrganizationId;
  nurseId: string;
  actorUserId: string;
  fromStatus: NurseStatus;
  toStatus: NurseStatus;
  action: CredentialAction;
};

export type VerifiedCredentialEvidence = Readonly<Brand<
  CredentialEvidenceShape,
  "VerifiedCredentialEvidence"
>>;
export type AuthorizedNurseStatusUpdate = Readonly<Brand<
  CredentialStatusUpdateExtras & { status: NurseStatus },
  "AuthorizedNurseStatusUpdate"
>>;
export type CredentialEvidenceContext = {
  organizationId: OrganizationId;
  nurseId: string;
  actorUserId: string;
  policyDecision: PolicyDecision;
};
export type ExpectedCredentialProof = CredentialEvidenceContext & {
  fromStatus: NurseStatus;
  toStatus?: NurseStatus;
  action: CredentialAction;
};

const credentialEvidence = new WeakSet<object>();
const VERIFY_SOURCES = new Set<NurseStatus>([
  "submitted",
  "under_review",
  "renewal_pending",
  "suspended",
  "expired",
]);
const REJECT_SOURCES = new Set<NurseStatus>(["submitted", "under_review", "renewal_pending"]);
const SUSPEND_SOURCES = new Set<NurseStatus>(["verified", "renewal_pending"]);

export function canVerifyCredential(
  fromStatus: NurseStatus,
  context: CredentialEvidenceContext,
): VerifiedCredentialEvidence {
  return credentialEvidenceFor("verify", VERIFY_SOURCES, fromStatus, "verified", context);
}

export function canRejectCredential(
  fromStatus: NurseStatus,
  context: CredentialEvidenceContext,
): VerifiedCredentialEvidence {
  return credentialEvidenceFor("reject", REJECT_SOURCES, fromStatus, "rejected", context);
}

export function canSuspendCredential(
  fromStatus: NurseStatus,
  context: CredentialEvidenceContext,
): VerifiedCredentialEvidence {
  return credentialEvidenceFor("suspend", SUSPEND_SOURCES, fromStatus, "suspended", context);
}

export function credentialStatusUpdate(
  evidence: VerifiedCredentialEvidence,
  expected: ExpectedCredentialProof,
  extras: CredentialStatusUpdateExtras = {},
): AuthorizedNurseStatusUpdate {
  if (!credentialEvidence.has(evidence)) {
    throw new Error("VerifiedCredentialEvidence proof is not valid");
  }
  if (
    evidence.organizationId !== expected.organizationId ||
    evidence.nurseId !== expected.nurseId ||
    evidence.actorUserId !== expected.actorUserId ||
    evidence.fromStatus !== expected.fromStatus ||
    evidence.action !== expected.action ||
    (expected.toStatus !== undefined && evidence.toStatus !== expected.toStatus)
  ) {
    throw new Error("VerifiedCredentialEvidence proof does not match persistence context");
  }
  return Object.freeze(brandValue<CredentialStatusUpdateExtras & { status: NurseStatus }, "AuthorizedNurseStatusUpdate">({
    ...extras,
    status: evidence.toStatus,
  }));
}

function credentialEvidenceFor(
  action: CredentialAction,
  allowedSources: ReadonlySet<NurseStatus>,
  fromStatus: NurseStatus,
  toStatus: NurseStatus,
  context: CredentialEvidenceContext,
): VerifiedCredentialEvidence {
  assertTenantActionAllowed(context.policyDecision);
  if (!allowedSources.has(fromStatus)) {
    throw new NurseCredentialValidationError(`Cannot ${action} credential from ${fromStatus}`);
  }
  const evidence = brandValue<CredentialEvidenceShape, "VerifiedCredentialEvidence">({
    organizationId: context.organizationId,
    nurseId: context.nurseId,
    actorUserId: context.actorUserId,
    fromStatus,
    toStatus,
    action,
  });
  credentialEvidence.add(evidence);
  return Object.freeze(evidence);
}
