import { db, eq, schema } from "@nurseconnect/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("./get-session", () => ({
  getSession: mockGetSession,
}));

const { authUsers, users } = schema;

describe("resolveCurrentSessionUser", () => {
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

  it("preserves first-admin bootstrap through central session resolution", async () => {
    process.env.FIRST_ADMIN_EMAILS = "admin@example.com";
    await db.insert(authUsers).values({
      id: "auth_session_admin_1",
      email: "admin@example.com",
      name: "Admin User",
      emailVerified: true,
    });
    mockGetSession.mockResolvedValue({
      user: {
        id: "auth_session_admin_1",
        email: "admin@example.com",
        name: "Admin User",
      },
    });

    const { resolveCurrentSessionUser } = await import("./session-user");
    const resolved = await resolveCurrentSessionUser();

    expect(resolved?.user.role).toBe("admin");
    expect(resolved?.session.user.id).toBe("auth_session_admin_1");

    const dbUser = await db.query.users.findFirst({
      where: eq(users.authId, "auth_session_admin_1"),
    });
    expect(dbUser?.role).toBe("admin");
  });
});
