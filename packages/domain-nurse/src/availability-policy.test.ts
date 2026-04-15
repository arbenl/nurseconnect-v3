import { describe, expect, it } from "vitest";

import { NurseAvailabilityError, assertCanSetSelfAvailability } from "./availability-policy";

describe("assertCanSetSelfAvailability", () => {
  it("allows verified nurses with a valid license to go available", () => {
    expect(() =>
      assertCanSetSelfAvailability({
        status: "verified",
        licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
      }),
    ).not.toThrow();
  });

  it("rejects non-verified nurses", () => {
    expect(() =>
      assertCanSetSelfAvailability({
        status: "submitted",
        licenseValidUntil: null,
      }),
    ).toThrow(NurseAvailabilityError);
  });

  it("rejects expired licenses", () => {
    expect(() =>
      assertCanSetSelfAvailability({
        status: "verified",
        licenseValidUntil: new Date("2020-01-01T00:00:00.000Z"),
      }),
    ).toThrow("license has expired");
  });
});
