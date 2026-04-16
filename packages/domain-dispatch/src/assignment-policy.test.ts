import { describe, expect, it } from "vitest";

import { DispatchValidationError } from "./errors";
import { assertDispatchEligibleNurse } from "./assignment-policy";

describe("assertDispatchEligibleNurse", () => {
  it("rejects a non-nurse role", () => {
    expect(() =>
      assertDispatchEligibleNurse({
        userExists: true,
        role: "patient",
        nurseExists: false,
        nurseStatus: null,
        licenseValidUntil: null,
      }),
    ).toThrow(DispatchValidationError);
  });

  it("rejects an unverified nurse", () => {
    expect(() =>
      assertDispatchEligibleNurse({
        userExists: true,
        role: "nurse",
        nurseExists: true,
        nurseStatus: "submitted",
        licenseValidUntil: null,
      }),
    ).toThrow("Target nurse is not verified");
  });

  it("rejects an expired license", () => {
    expect(() =>
      assertDispatchEligibleNurse({
        userExists: true,
        role: "nurse",
        nurseExists: true,
        nurseStatus: "verified",
        licenseValidUntil: "2020-01-01T00:00:00.000Z",
      }),
    ).toThrow("Target nurse license has expired");
  });
});
