import { describe, expect, it } from "vitest";

import {
  ReferralPartnerInactiveError,
  ReferralPartnerNotFoundError,
  ReferralPartnerValidationError,
} from "./errors";
import {
  assertReferralPartnerActive,
  createReferralPartnerProfile,
} from "./partner-profile";

describe("referral partner profile policy", () => {
  it("requires an active profile for partner operations", () => {
    expect(() => assertReferralPartnerActive("active")).not.toThrow();
    expect(() => assertReferralPartnerActive(null)).toThrow(ReferralPartnerNotFoundError);
  });

  it("blocks inactive partners from continuing partner flows", () => {
    expect(() => assertReferralPartnerActive("inactive")).toThrow(
      ReferralPartnerInactiveError,
    );
  });

  it("rejects blank organization names", async () => {
    await expect(
      createReferralPartnerProfile({
        userId: "partner-user-1",
        organizationName: "   ",
      }),
    ).rejects.toThrow(ReferralPartnerValidationError);
  });
});
