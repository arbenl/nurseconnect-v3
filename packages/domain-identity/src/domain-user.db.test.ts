import { db, eq, schema } from "@nurseconnect/database";
import { createNurseRecord, getNurseByUserId } from "@nurseconnect/domain-nurse";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureDomainUserFromSession, maybeBootstrapFirstAdmin } from "./domain-user";

const { users } = schema;

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

describe("maybeBootstrapFirstAdmin", () => {
  let originalEnv: string | undefined;

  beforeEach(async () => {
    await db.execute(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
    originalEnv = process.env.FIRST_ADMIN_EMAILS;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FIRST_ADMIN_EMAILS;
    } else {
      process.env.FIRST_ADMIN_EMAILS = originalEnv;
    }
  });

  it("does not promote the first user when FIRST_ADMIN_EMAILS is unset", async () => {
    delete process.env.FIRST_ADMIN_EMAILS;

    const domainUser = await ensureDomainUserFromSession({
      id: "auth_123",
      email: "first@example.com",
      name: "First User",
    });

    const result = assertDefined(
      await maybeBootstrapFirstAdmin(assertDefined(domainUser, "Expected domain user to be created")),
      "Expected bootstrap result",
    );

    expect(result.role).toBe("patient");
  });

  it("does not promote a user when their email is not on the allowlist", async () => {
    process.env.FIRST_ADMIN_EMAILS = "admin@example.com,ceo@example.com";

    const domainUser = await ensureDomainUserFromSession({
      id: "auth_456",
      email: "random@example.com",
      name: "Random User",
    });

    const result = assertDefined(
      await maybeBootstrapFirstAdmin(assertDefined(domainUser, "Expected domain user to be created")),
      "Expected bootstrap result",
    );

    expect(result.role).toBe("patient");
  });

  it("promotes a user when their email matches the allowlist", async () => {
    process.env.FIRST_ADMIN_EMAILS = "admin1@example.com,ADMIN2@example.com";

    const domainUser = await ensureDomainUserFromSession({
      id: "auth_789",
      email: "admin2@example.com",
      name: "Admin User",
    });

    const persistedUser = assertDefined(domainUser, "Expected domain user to be created");
    const result = assertDefined(
      await maybeBootstrapFirstAdmin(persistedUser),
      "Expected bootstrap result",
    );

    expect(result.role).toBe("admin");

    const [dbUser] = await db.select().from(users).where(eq(users.id, persistedUser.id));
    expect(dbUser?.role).toBe("admin");
  });

  it("leaves an already-admin user unchanged", async () => {
    delete process.env.FIRST_ADMIN_EMAILS;

    const domainUser = await ensureDomainUserFromSession({
      id: "auth_999",
      email: "already@admin.com",
      name: "Existing Admin",
    });

    const persistedUser = assertDefined(domainUser, "Expected domain user to be created");
    const [adminUser] = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.id, persistedUser.id))
      .returning();

    const result = assertDefined(
      await maybeBootstrapFirstAdmin(assertDefined(adminUser, "Expected admin user row")),
      "Expected bootstrap result",
    );

    expect(result.role).toBe("admin");
  });

  it("creates and retrieves nurse records through the interim nurse adapter", async () => {
    const domainUser = await ensureDomainUserFromSession({
      id: "auth_nurse_record_1",
      email: "nurse-record@example.com",
      name: "Nurse Record User",
    });

    const persistedUser = assertDefined(domainUser, "Expected domain user to be created");
    const created = await createNurseRecord(persistedUser.id);
    const loaded = await getNurseByUserId(persistedUser.id);

    expect(created?.userId).toBe(persistedUser.id);
    expect(created?.status).toBe("draft");
    expect(loaded).toMatchObject({
      userId: persistedUser.id,
      status: "draft",
    });
  });
});
