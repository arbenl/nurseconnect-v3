import type { CreateRequestInput } from "@nurseconnect/contracts";

import { RequestCreationValidationError } from "./errors";

type CreateRequestInvariantInput = Pick<
  CreateRequestInput,
  "requestType" | "scheduledFor"
> & {
  serviceAreaId: string | null;
};

export function assertCreateRequestInvariants(
  input: CreateRequestInvariantInput,
): void {
  if (input.requestType === "scheduled" && !input.scheduledFor) {
    throw new RequestCreationValidationError(
      "scheduledFor is required for scheduled requests",
    );
  }

  if (input.requestType === "same_day" && input.scheduledFor != null) {
    throw new RequestCreationValidationError(
      "scheduledFor must be omitted for same-day requests",
    );
  }

  if (!input.serviceAreaId) {
    throw new RequestCreationValidationError(
      "Request location is outside all active service areas",
    );
  }
}
