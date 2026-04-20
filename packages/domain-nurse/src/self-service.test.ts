import { describe, expect, it } from "vitest";

import { NurseCredentialValidationError } from "./errors";
import { assertCanSubmitOwnNurseApplication } from "./self-service";

describe("assertCanSubmitOwnNurseApplication", () => {
  it("allows no existing status and in-progress applicant statuses", () => {
    expect(() => assertCanSubmitOwnNurseApplication(null)).not.toThrow();
    expect(() => assertCanSubmitOwnNurseApplication("draft")).not.toThrow();
    expect(() => assertCanSubmitOwnNurseApplication("submitted")).not.toThrow();
  });

  it("rejects admin-owned and supply-protected statuses", () => {
    expect(() => assertCanSubmitOwnNurseApplication("verified")).toThrow(
      NurseCredentialValidationError,
    );
    expect(() => assertCanSubmitOwnNurseApplication("under_review")).toThrow(
      /not allowed/i,
    );
    expect(() => assertCanSubmitOwnNurseApplication("suspended")).toThrow(
      /not allowed/i,
    );
  });
});
