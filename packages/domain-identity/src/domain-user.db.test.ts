import { db, eq, schema } from "@nurseconnect/database";
import { createNurseRecord, getNurseByUserId } from "@nurseconnect/domain-nurse";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureDomainUserFromSession, maybeBootstrapFirstAdmin } from "./domain-user";
import { resolveSessionUser } from "./session-user";

const { authUsers, users } = schema;

function assertDefined<T>(value: T | null | undefined, message: string): T {
  if (value == null) {
    throw new Error(message);
  }

  return value;
}

async function insertAuthUser(input: { id: string; email: string; emailVerified?: boolean; name?: string }) {
  await db.insert(authUsers).values({
    id: input.id,
    email: input.email,
    name: input.name ?? null,
    emailVerified: input.emailVerified ?? true,
  });
}

describe("domain identity auth bridge", () => {
  let originalEnv: string | undefined;

  beforeEach(async () => {
    await db.execute(`TRUNCATE TABLE "auth_users", "users" RESTART IDENTITY CASCADE`);
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
    await insertAuthUser({
      id: "auth_789",
      email: "admin2@example.com",
      emailVerified: true,
      name: "Admin User",
    });

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

  it("does not promote an allowlisted user when their auth email is unverified", async () => {
    process.env.FIRST_ADMIN_EMAILS = "admin2@example.com";
    await insertAuthUser({
      id: "auth_unverified_admin",
      email: "admin2@example.com",
      emailVerified: false,
      name: "Unverified Admin",
    });

    const domainUser = assertDefined(
      await ensureDomainUserFromSession({
        id: "auth_unverified_admin",
        email: "admin2@example.com",
        name: "Unverified Admin",
      }),
      "Expected domain user to be created",
    );

    const result = assertDefined(
      await maybeBootstrapFirstAdmin(domainUser),
      "Expected bootstrap result",
    );

    expect(result.role).toBe("patient");
  });

  it("claims an unauthenticated patient shell by email instead of creating a duplicate", async () => {
    await insertAuthUser({
      id: "auth_shell_patient_1",
      email: "shell-patient@test.local",
      emailVerified: true,
      name: "Shell Patient",
    });
    const [shell] = await db
      .insert(users)
      .values({
        email: "shell-patient@test.local",
        role: "patient",
        firstName: "Shell",
        lastName: "Patient",
      })
      .returning();

    const domainUser = assertDefined(
      await ensureDomainUserFromSession({
        id: "auth_shell_patient_1",
        email: "SHELL-PATIENT@test.local",
        name: "Shell Patient",
      }),
      "Expected domain user to be created",
    );

    expect(domainUser.id).toBe(shell?.id);
    expect(domainUser.authId).toBe("auth_shell_patient_1");
    expect(domainUser.role).toBe("patient");
    expect(domainUser.email).toBe("shell-patient@test.local");

    const rows = await db.select().from(users).where(eq(users.email, "shell-patient@test.local"));
    expect(rows).toHaveLength(1);
  });

  it("does not claim an unauthenticated shell when auth email is unverified", async () => {
    await insertAuthUser({
      id: "auth_unverified_shell_1",
      email: "unverified-shell@test.local",
      emailVerified: false,
      name: "Unverified Shell",
    });
    const [shell] = await db
      .insert(users)
      .values({
        email: "unverified-shell@test.local",
        role: "patient",
        firstName: "Unverified",
        lastName: "Shell",
      })
      .returning();

    const domainUser = assertDefined(
      await ensureDomainUserFromSession({
        id: "auth_unverified_shell_1",
        email: "unverified-shell@test.local",
        name: "Unverified Shell",
      }),
      "Expected domain user to be created",
    );

    expect(domainUser.id).not.toBe(shell?.id);
    expect(domainUser.authId).toBe("auth_unverified_shell_1");

    const [unchangedShell] = await db.select().from(users).where(eq(users.id, shell!.id));
    expect(unchangedShell?.authId).toBeNull();
  });

  it("rejects ambiguous unauthenticated shell rows instead of guessing a claim target", async () => {
    await insertAuthUser({
      id: "auth_ambiguous_shell_1",
      email: "ambiguous-shell@test.local",
      emailVerified: true,
      name: "Ambiguous Shell",
    });
    await db.insert(users).values([
      { email: "ambiguous-shell@test.local", role: "patient", firstName: "One" },
      { email: "ambiguous-shell@test.local", role: "patient", firstName: "Two" },
    ]);

    await expect(
      ensureDomainUserFromSession({
        id: "auth_ambiguous_shell_1",
        email: "ambiguous-shell@test.local",
        name: "Ambiguous Shell",
      }),
    ).rejects.toThrow("Ambiguous unauthenticated shell rows for email");
  });

  it("claims an unauthenticated referral partner invite by email without changing role", async () => {
    await insertAuthUser({
      id: "auth_invited_partner_1",
      email: "invited-partner@test.local",
      emailVerified: true,
      name: "Signed Partner",
    });
    const [invite] = await db
      .insert(users)
      .values({
        email: "invited-partner@test.local",
        role: "referral_partner",
        name: "Invited Partner",
      })
      .returning();

    const domainUser = assertDefined(
      await ensureDomainUserFromSession({
        id: "auth_invited_partner_1",
        email: "invited-partner@test.local",
        name: "Signed Partner",
      }),
      "Expected domain user to be created",
    );

    expect(domainUser.id).toBe(invite?.id);
    expect(domainUser.authId).toBe("auth_invited_partner_1");
    expect(domainUser.role).toBe("referral_partner");

    const rows = await db.select().from(users).where(eq(users.email, "invited-partner@test.local"));
    expect(rows).toHaveLength(1);
  });

  it("does not update an existing auth user when session data is unchanged", async () => {
    const domainUser = assertDefined(
      await ensureDomainUserFromSession({
        id: "auth_stable_session_1",
        email: "stable-session@test.local",
        name: "Stable Session",
      }),
      "Expected domain user to be created",
    );
    const fixedUpdatedAt = new Date("2026-01-01T00:00:00.000Z");

    await db.update(users).set({ updatedAt: fixedUpdatedAt }).where(eq(users.id, domainUser.id));

    const resolvedAgain = assertDefined(
      await ensureDomainUserFromSession({
        id: "auth_stable_session_1",
        email: "stable-session@test.local",
        name: "Stable Session",
      }),
      "Expected existing domain user to resolve",
    );

    expect(resolvedAgain.updatedAt.getTime()).toBe(fixedUpdatedAt.getTime());
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

  it("resolves authenticated sessions through a domain user with a matching authId", async () => {
    const resolved = assertDefined(
      await resolveSessionUser({
        user: {
          id: "auth_session_bridge_1",
          email: "session-bridge@example.com",
          name: "Session Bridge",
        },
      }),
      "Expected session user to resolve",
    );

    expect(resolved.session.user.id).toBe("auth_session_bridge_1");
    expect(resolved.user.authId).toBe("auth_session_bridge_1");
    expect(resolved.user.email).toBe("session-bridge@example.com");
  });

  it("does not resolve sessions without an auth id and email", async () => {
    await expect(resolveSessionUser(null)).resolves.toBeNull();
    await expect(resolveSessionUser({ user: { email: "missing-id@example.com" } })).resolves.toBeNull();
    await expect(resolveSessionUser({ user: { id: "missing_email" } })).resolves.toBeNull();
  });
});
