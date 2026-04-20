import type { DbClient } from "@nurseconnect/database";
import { referralPartners, users } from "@nurseconnect/database/schema";
import { eq } from "drizzle-orm";

import {
  ReferralPartnerInactiveError,
  ReferralPartnerNotFoundError,
  ReferralPartnerValidationError,
} from "./errors";

export type ReferralPartnerStatus = typeof referralPartners.$inferSelect.status;
export type ReferralPartnerProfile = typeof referralPartners.$inferSelect;

type Database = DbClient;

type PostgresErrorLike = {
  code?: string;
};

async function resolveDatabase(database?: Database) {
  if (database) {
    return database;
  }

  const { db } = await import("@nurseconnect/database");
  return db;
}

function normalizeOrganizationName(organizationName: string) {
  const normalized = organizationName.trim();

  if (!normalized) {
    throw new ReferralPartnerValidationError("Organization name is required");
  }

  return normalized;
}

export async function createReferralPartnerProfile(
  input: {
    userId: string;
    organizationName: string;
    status?: ReferralPartnerStatus;
  },
  database?: Database,
): Promise<ReferralPartnerProfile> {
  const organizationName = normalizeOrganizationName(input.organizationName);
  const resolvedDb = await resolveDatabase(database);

  const [user] = await resolvedDb
    .select({
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, input.userId));

  if (!user) {
    throw new ReferralPartnerValidationError("Referral partner user not found");
  }

  if (user.role !== "referral_partner") {
    throw new ReferralPartnerValidationError("User must have the referral_partner role");
  }

  try {
    const [profile] = await resolvedDb
      .insert(referralPartners)
      .values({
        userId: input.userId,
        organizationName,
        status: input.status ?? "active",
      })
      .returning();

    if (!profile) {
      throw new ReferralPartnerValidationError("Failed to create referral partner profile");
    }

    return profile;
  } catch (error) {
    if ((error as PostgresErrorLike).code === "23505") {
      throw new ReferralPartnerValidationError(
        "Referral partner profile already exists for this user",
      );
    }

    throw error;
  }
}

export async function getReferralPartnerProfileByUserId(
  input: { userId: string },
  database?: Database,
): Promise<ReferralPartnerProfile> {
  const resolvedDb = await resolveDatabase(database);
  const [profile] = await resolvedDb
    .select()
    .from(referralPartners)
    .where(eq(referralPartners.userId, input.userId));

  if (!profile) {
    throw new ReferralPartnerNotFoundError();
  }

  return profile;
}

export function assertReferralPartnerActive(status: ReferralPartnerStatus | null | undefined) {
  if (!status) {
    throw new ReferralPartnerNotFoundError();
  }

  if (status !== "active") {
    throw new ReferralPartnerInactiveError();
  }
}

export async function setReferralPartnerStatus(
  input: {
    userId: string;
    status: ReferralPartnerStatus;
  },
  database?: Database,
): Promise<ReferralPartnerProfile> {
  const resolvedDb = await resolveDatabase(database);
  const [profile] = await resolvedDb
    .update(referralPartners)
    .set({
      status: input.status,
      updatedAt: new Date(),
    })
    .where(eq(referralPartners.userId, input.userId))
    .returning();

  if (!profile) {
    throw new ReferralPartnerNotFoundError();
  }

  return profile;
}
