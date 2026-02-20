import { db, schema, eq } from "@nurseconnect/database";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

const { users } = schema;

describe("users.role Enum Hardening", () => {
    beforeEach(async () => {
        // Isolate DB state
        await db.execute(`TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`);
    });

    it("should successfully insert a user with valid enum roles", async () => {
        const roles: ("patient" | "nurse" | "admin")[] = ["patient", "nurse", "admin"];

        for (const validRole of roles) {
            const [inserted] = await db
                .insert(users)
                .values({
                    email: `${validRole}@example.com`,
                    name: `${validRole} Test`,
                    role: validRole,
                })
                .returning();

            expect(inserted!.role).toBe(validRole);
        }
    });

    it("should reject an invalid role strictly at the database level", async () => {
        // We cast to `any` to bypass TypeScript, proving that PostgreSQL itself enforcing the restriction.
        await expect(
            db
                .insert(users)
                .values({
                    email: "invalid@example.com",
                    name: "Invalid Editor",
                    role: "superadmin" as any, // Bypass TS to test DB constraint
                })
        ).rejects.toThrowError(/invalid input value for enum user_role/);
    });
});
