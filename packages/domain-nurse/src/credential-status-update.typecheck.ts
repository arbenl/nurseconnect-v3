import { nurses } from "@nurseconnect/database/schema";

import { credentialStatusUpdate, type AuthorizedNurseStatusUpdate } from "./credential-evidence";

// @ts-expect-error raw status values need VerifiedCredentialEvidence.
credentialStatusUpdate("verified", {
  organizationId: "org-1",
  nurseId: "nurse-1",
  actorUserId: "actor-1",
  policyDecision: { allowed: true },
  fromStatus: "submitted",
  action: "verify",
});

function acceptsAuthorizedNurseStatusUpdate(_update: AuthorizedNurseStatusUpdate) {}

const rawStatusUpdate = { status: "verified", updatedAt: new Date() };
const directNurseStatusWrite: Pick<typeof nurses.$inferInsert, "status"> = {
  status: "verified",
};

// @ts-expect-error raw status update objects are not authorized nurse updates.
const typedStatusUpdate: AuthorizedNurseStatusUpdate = rawStatusUpdate;

// @ts-expect-error direct nurses.status writes need VerifiedCredentialEvidence.
const typedDirectWrite: AuthorizedNurseStatusUpdate = directNurseStatusWrite;

// @ts-expect-error direct raw status updates cannot satisfy authorized update input.
acceptsAuthorizedNurseStatusUpdate({ status: "verified", updatedAt: new Date() });
