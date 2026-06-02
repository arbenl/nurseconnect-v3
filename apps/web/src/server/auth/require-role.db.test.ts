import { db, eq, schema } from "@nurseconnect/database";
import { UnauthorizedError } from "@nurseconnect/domain-identity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("./get-session", () => ({
  getSession: mockGetSession,
}));

const { authUsers, referralPartners, users } = schema;

describe("requireRole", () => {
  let originalFirstAdminEmails: string | undefined;

  beforeEach(async () => {
    await db.execute(`TRUNCATE TABLE "auth_users", "users" RESTART IDENTITY CASCADE`);
    originalFirstAdminEmails = process.env.FIRST_ADMIN_EMAILS;
    mockGetSession.mockReset();
  });

  afterEach(() => {
    if (originalFirstAdminEmails === undefined) {
      delete process.env.FIRST_ADMIN_EMAILS;
    } else {
      process.env.FIRST_ADMIN_EMAILS = originalFirstAdminEmails;
    }
  });

  it("bootstraps and authorizes the configured first admin from session context", async () => {
    process.env.FIRST_ADMIN_EMAILS = "admin@example.com";
    await db.insert(authUsers).values({
      id: "auth_admin_1",
      email: "admin@example.com",
      name: "Admin User",
      emailVerified: true,
    });
    mockGetSession.mockResolvedValue({
      user: {
        id: "auth_admin_1",
        email: "admin@example.com",
        name: "Admin User",
      },
    });

    const { requireRole } = await import("./require-role");
    const result = await requireRole("admin");

    expect(result.user.role).toBe("admin");
    expect(result.user.email).toBe("admin@example.com");
    expect(result.session.user.id).toBe("auth_admin_1");

    const dbUser = await db.query.users.findFirst({
      where: eq(users.authId, "auth_admin_1"),
    });
    expect(dbUser?.role).toBe("admin");
  });

  it("throws the shared UnauthorizedError when no session is present", async () => {
    mockGetSession.mockResolvedValue(null);

    const { requireRole } = await import("./require-role");

    await expect(requireRole("admin")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("authorizes a referral partner actor when the required role matches", async () => {
    const [partner] = await db
      .insert(users)
      .values({
        email: "partner@test.local",
        authId: "auth_partner_1",
        role: "referral_partner",
      })
      .returning();

    mockGetSession.mockResolvedValue({
      user: {
        id: "auth_partner_1",
        email: "partner@test.local",
        name: "Partner User",
      },
    });

    const { requireRole } = await import("./require-role");
    const result = await requireRole("referral_partner");

    if (!partner) {
      throw new Error("Expected inserted referral partner user");
    }
    expect(result.user.id).toBe(partner.id);
    expect(result.user.role).toBe("referral_partner");
  });

  it("enforces one referral-partner profile row per user", async () => {
    const [partner] = await db
      .insert(users)
      .values({
        email: "partner-profile@test.local",
        authId: "auth_partner_profile_1",
        role: "referral_partner",
      })
      .returning();

    if (!partner) {
      throw new Error("Expected inserted referral partner user");
    }
    await db.insert(referralPartners).values({
      userId: partner.id,
      organizationName: "City Clinic",
      status: "active",
    });

    await expect(
      db.insert(referralPartners).values({
        userId: partner.id,
        organizationName: "City Clinic Duplicate",
        status: "inactive",
      }),
    ).rejects.toThrow();
  });
});
