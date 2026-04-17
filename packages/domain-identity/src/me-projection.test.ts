import { schema } from "@nurseconnect/database";
import { describe, expect, it } from "vitest";

import { buildMeUserProjection, isUserPortalProfileComplete } from "./me-projection";

type DomainUser = typeof schema.users.$inferSelect;
type NurseRecord = typeof schema.nurses.$inferSelect;

function userFixture(role: DomainUser["role"]): DomainUser {
  return {
    id: "user_1",
    authId: "auth_1",
    firebaseUid: null,
    email: "user@test.local",
    role,
    name: "Test User",
    firstName: "Pat",
    lastName: "Ient",
    phone: "+38344123456",
    city: "Pristina",
    address: "Main Street 1",
    profileCompletedAt: new Date("2026-04-17T00:00:00.000Z"),
    createdAt: new Date("2026-04-17T00:00:00.000Z"),
    updatedAt: new Date("2026-04-17T00:00:00.000Z"),
  };
}

function nurseFixture(overrides: Partial<NurseRecord> = {}): NurseRecord {
  return {
    id: "nurse_1",
    userId: "user_1",
    status: "verified",
    phone: null,
    bio: null,
    licenseNumber: "RN-123",
    licenseJurisdiction: "CA",
    specialization: "ICU",
    licenseValidUntil: new Date("2027-12-31T00:00:00.000Z"),
    verifiedBy: null,
    verifiedAt: null,
    suspendedAt: null,
    suspensionReason: null,
    isAvailable: true,
    createdAt: new Date("2026-04-17T00:00:00.000Z"),
    updatedAt: new Date("2026-04-17T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildMeUserProjection", () => {
  it("treats a patient with complete base profile fields as profile-complete", () => {
    const user = userFixture("patient");

    const result = buildMeUserProjection(user, null);

    expect(result.profileComplete).toBe(true);
    expect(result.profile).toMatchObject({
      firstName: "Pat",
      lastName: "Ient",
      phone: "+38344123456",
      city: "Pristina",
      address: "Main Street 1",
    });
    expect(result.nurseProfile).toBeNull();
  });

  it("treats a nurse with a complete base profile but missing nurse fields as not profile-complete", () => {
    const result = buildMeUserProjection(
      userFixture("nurse"),
      nurseFixture({
        licenseNumber: null,
        specialization: null,
      }),
    );

    expect(result.profileComplete).toBe(false);
  });

  it("uses the same derived-completion helper as the final projection", () => {
    const user = userFixture("nurse");
    const nurse = nurseFixture();

    expect(buildMeUserProjection(user, nurse).profileComplete).toBe(
      isUserPortalProfileComplete(user, nurse),
    );
  });
});
