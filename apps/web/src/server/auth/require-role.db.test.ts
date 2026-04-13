import { db, eq, schema } from "@nurseconnect/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();

vi.mock("./get-session", () => ({
  getSession: mockGetSession,
}));

const { users } = schema;

describe("requireRole", () => {
  let originalFirstAdminEmails: string | undefined;

  beforeEach(async () => {
    await db.execute(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
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
});
