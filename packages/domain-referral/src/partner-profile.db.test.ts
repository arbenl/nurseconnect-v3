import { db, eq, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ReferralPartnerValidationError,
} from "./errors";
import {
  createReferralPartnerProfile,
  getReferralPartnerProfileByUserId,
  setReferralPartnerStatus,
} from "./partner-profile";

const { referralPartners, users } = schema;

describe.sequential("referral partner profile persistence", () => {
  beforeAll(async () => {
    await db.execute(sql`SELECT 1`);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE referral_partners RESTART IDENTITY CASCADE`);
    await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
  });

  it("creates a partner profile for a referral_partner user", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "partner-profile-create@test.local",
        role: "referral_partner",
      })
      .returning();

    if (!user) {
      throw new Error("Expected inserted referral partner user");
    }

    const profile = await createReferralPartnerProfile({
      userId: user.id,
      organizationName: "City Clinic",
    });

    expect(profile).toMatchObject({
      userId: user.id,
      organizationName: "City Clinic",
      status: "active",
    });

    const persisted = await getReferralPartnerProfileByUserId({ userId: user.id });
    expect(persisted).toMatchObject({
      userId: user.id,
      organizationName: "City Clinic",
      status: "active",
    });
  });

  it("rejects duplicate partner profiles for the same user", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "partner-profile-duplicate@test.local",
        role: "referral_partner",
      })
      .returning();

    if (!user) {
      throw new Error("Expected inserted referral partner user");
    }

    await createReferralPartnerProfile({
      userId: user.id,
      organizationName: "City Clinic",
    });

    await expect(
      createReferralPartnerProfile({
        userId: user.id,
        organizationName: "City Clinic Two",
      }),
    ).rejects.toThrow(ReferralPartnerValidationError);
  });

  it("allows activation and deactivation updates", async () => {
    const [user] = await db
      .insert(users)
      .values({
        email: "partner-profile-status@test.local",
        role: "referral_partner",
      })
      .returning();

    if (!user) {
      throw new Error("Expected inserted referral partner user");
    }

    await createReferralPartnerProfile({
      userId: user.id,
      organizationName: "City Clinic",
      status: "inactive",
    });

    const activated = await setReferralPartnerStatus({
      userId: user.id,
      status: "active",
    });
    expect(activated.status).toBe("active");

    const deactivated = await setReferralPartnerStatus({
      userId: user.id,
      status: "inactive",
    });
    expect(deactivated.status).toBe("inactive");

    const persisted = await db.query.referralPartners.findFirst({
      where: eq(referralPartners.userId, user.id),
    });
    expect(persisted?.status).toBe("inactive");
  });
});
