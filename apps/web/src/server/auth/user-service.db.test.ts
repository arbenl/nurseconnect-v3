import { db, schema, eq } from "@nurseconnect/database";
import { describe, it, expect, beforeEach, afterEach } from "vitest";


import { maybeBootstrapFirstAdmin, ensureDomainUserFromSession } from "../../lib/user-service";

const { users } = schema;

describe("maybeBootstrapFirstAdmin", () => {
    let originalEnv: string | undefined;

    beforeEach(async () => {
        // Isolate DB state exactly like other .db.test.ts files
        await db.execute(
            `TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`
        );
        originalEnv = process.env.FIRST_ADMIN_EMAILS;
    });

    afterEach(() => {
        // Restore env
        if (originalEnv === undefined) {
            delete process.env.FIRST_ADMIN_EMAILS;
        } else {
            process.env.FIRST_ADMIN_EMAILS = originalEnv;
        }
    });

    it("should NOT promote the first user when FIRST_ADMIN_EMAILS is unset (fallback removed)", async () => {
        delete process.env.FIRST_ADMIN_EMAILS; // Explicitly unset

        const domainUser = await ensureDomainUserFromSession({
            id: "auth_123",
            email: "first@example.com",
            name: "First User",
        });

        const result = await maybeBootstrapFirstAdmin(domainUser!);

        expect(result!.role).toBe("patient"); // Remains default
    });

    it("should NOT promote a user when FIRST_ADMIN_EMAILS is set but their email is not in the list", async () => {
        process.env.FIRST_ADMIN_EMAILS = "admin@example.com,ceo@example.com";

        const domainUser = await ensureDomainUserFromSession({
            id: "auth_456",
            email: "random@example.com",
            name: "Random User",
        });

        const result = await maybeBootstrapFirstAdmin(domainUser!);

        expect(result!.role).toBe("patient"); // Remains default
    });

    it("should promote a user when their email exactly matches the FIRST_ADMIN_EMAILS list", async () => {
        process.env.FIRST_ADMIN_EMAILS = "admin1@example.com,ADMIN2@example.com";

        const domainUser = await ensureDomainUserFromSession({
            id: "auth_789",
            email: "admin2@example.com", // testing case-insensitivity mapping
            name: "Admin User",
        });

        const result = await maybeBootstrapFirstAdmin(domainUser!);

        expect(result!.role).toBe("admin"); // Promoted

        // Verify DB persistence
        const [dbUser] = await db.select().from(users).where(eq(users.id, domainUser!.id));
        expect(dbUser!.role).toBe("admin");
    });

    it("should leave an already-admin user completely unchanged", async () => {
        delete process.env.FIRST_ADMIN_EMAILS; // Prove it works regardless of env

        const domainUser = await ensureDomainUserFromSession({
            id: "auth_999",
            email: "already@admin.com",
            name: "Existing Admin",
        });

        // Force role in DB manually to setup the state
        const [adminUser] = await db
            .update(users)
            .set({ role: "admin" })
            .where(eq(users.id, domainUser!.id))
            .returning();

        const result = await maybeBootstrapFirstAdmin(adminUser!);

        expect(result!.role).toBe("admin");
    });
});
