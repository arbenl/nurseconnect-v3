import type { CreateRequestInput } from "@nurseconnect/contracts";

import { ReferralPartnerValidationError } from "./errors";
import type { ReferralPartnerStatus } from "./partner-profile";
import { assertReferralPartnerActive } from "./partner-profile";

type PartnerRequestDraft = Omit<CreateRequestInput, "referralSource" | "referralPartnerId"> &
  Partial<Pick<CreateRequestInput, "referralSource" | "referralPartnerId">>;

export function buildPartnerRequestInput(input: {
  actorUserId: string;
  partnerUserId: string;
  partnerStatus: ReferralPartnerStatus;
  request: PartnerRequestDraft;
}): CreateRequestInput {
  assertReferralPartnerActive(input.partnerStatus);

  if (input.actorUserId !== input.partnerUserId) {
    throw new ReferralPartnerValidationError("Partner identity mismatch");
  }

  return {
    ...input.request,
    referralSource: "partner",
    referralPartnerId: input.partnerUserId,
  };
}
