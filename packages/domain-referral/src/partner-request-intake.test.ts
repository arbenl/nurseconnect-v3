import { describe, expect, it } from "vitest";

import { ReferralPartnerInactiveError } from "./errors";
import { buildPartnerRequestInput } from "./partner-request-intake";

describe("partner request intake policy", () => {
  it("only allows active partner profiles to submit partner requests", () => {
    expect(() =>
      buildPartnerRequestInput({
        actorUserId: "partner-user-1",
        partnerUserId: "partner-user-1",
        partnerStatus: "inactive",
        request: {
          address: "123 Partner St, Pristina",
          lat: 42.6629,
          lng: 21.1655,
          requestType: "same_day",
          careType: "wound_care",
          referralSource: "consumer",
          referralPartnerId: null,
        },
      }),
    ).toThrow(ReferralPartnerInactiveError);
  });

  it("always stamps partner referral metadata", () => {
    const result = buildPartnerRequestInput({
      actorUserId: "partner-user-1",
      partnerUserId: "partner-user-1",
      partnerStatus: "active",
      request: {
        address: "123 Partner St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "scheduled",
        scheduledFor: "2027-01-15T09:30:00.000Z",
        careType: "wound_care",
        referralSource: "consumer",
        referralPartnerId: null,
      },
    });

    expect(result.referralSource).toBe("partner");
    expect(result.referralPartnerId).toBe("partner-user-1");
  });

  it("does not allow a partner to spoof another partner id", () => {
    const result = buildPartnerRequestInput({
      actorUserId: "partner-user-1",
      partnerUserId: "partner-user-1",
      partnerStatus: "active",
      request: {
        address: "123 Partner St, Pristina",
        lat: 42.6629,
        lng: 21.1655,
        requestType: "same_day",
        careType: "wound_care",
        referralSource: "partner",
        referralPartnerId: "other-partner",
      },
    });

    expect(result.referralPartnerId).toBe("partner-user-1");
  });

  it("drops non-request fields before creating the request input", () => {
    const requestWithExtraFields = {
      address: "123 Partner St, Pristina",
      lat: 42.6629,
      lng: 21.1655,
      requestType: "same_day",
      careType: "wound_care",
      patient: {
        email: "patient@test.local",
      },
    } as Parameters<typeof buildPartnerRequestInput>[0]["request"] & {
      patient: { email: string };
    };

    const result = buildPartnerRequestInput({
      actorUserId: "partner-user-1",
      partnerUserId: "partner-user-1",
      partnerStatus: "active",
      request: requestWithExtraFields,
    });

    expect(result).not.toHaveProperty("patient");
  });
});
