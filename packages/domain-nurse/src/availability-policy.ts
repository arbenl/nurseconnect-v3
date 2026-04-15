import { NurseAvailabilityError } from "./errors";

export { NurseAvailabilityError };

export function assertCanSetSelfAvailability(input: {
  status: string;
  licenseValidUntil: Date | null;
}) {
  if (input.status !== "verified") {
    throw new NurseAvailabilityError("Forbidden: Nurse is not verified");
  }

  if (input.licenseValidUntil && input.licenseValidUntil <= new Date()) {
    throw new NurseAvailabilityError("Forbidden: Nurse license has expired");
  }
}
