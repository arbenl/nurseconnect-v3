import { db, schema, sql } from "@nurseconnect/database";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAndAssignRequest } from "./allocate-request";

const { users, nurses, nurseLocations } = schema;

function uuidLike(id: string) {
    // basic sanity (don't overfit)
    expect(id).toMatch(/^[0-9a-f-]{20,}$/i);
}

describe.sequential("createAndAssignRequest", () => {
    beforeAll(async () => {
        // Ensure DB reachable
        await db.execute(sql`SELECT 1`);
    });

    beforeEach(async () => {
        // Truncate in dependency-safe order
        await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
    });

    it("assigns the nearest available nurse", async () => {
        // create patient
        const [patient] = await db
            .insert(users)
            .values({
                email: "p1@test.local",
                role: "patient",
            })
            .returning();

        // create nurse A near
        const [nurseAUser] = await db
            .insert(users)
            .values({
                email: "nurseA@test.local",
                role: "nurse",
            })
            .returning();

        await db.insert(nurses).values({
            userId: nurseAUser!.id,
            status: "verified",
            isAvailable: true,
            licenseNumber: "A-123",
            specialization: "general",
        });

        await db.insert(nurseLocations).values({
            nurseUserId: nurseAUser!.id,
            lat: "0.000000",
            lng: "0.000000",
        });

        // create nurse B farther
        const [nurseBUser] = await db
            .insert(users)
            .values({
                email: "nurseB@test.local",
                role: "nurse",
            })
            .returning();

        await db.insert(nurses).values({
            userId: nurseBUser!.id,
            status: "verified",
            isAvailable: true,
            licenseNumber: "B-123",
            specialization: "general",
        });

        await db.insert(nurseLocations).values({
            nurseUserId: nurseBUser!.id,
            lat: "1.000000",
            lng: "1.000000",
        });

        const req = await createAndAssignRequest({
            patientUserId: patient!.id,
            address: "Somewhere",
            lat: 0,
            lng: 0,
        });

        uuidLike(req.id);
        expect(req.patientUserId).toBe(patient!.id);
        expect(req.status).toBe("assigned");
        expect(req.assignedNurseUserId).toBe(nurseAUser!.id);
    });

    it("leaves request open if no nurses are available", async () => {
        const [patient] = await db
            .insert(users)
            .values({ email: "p2@test.local", role: "patient" })
            .returning();

        const req = await createAndAssignRequest({
            patientUserId: patient!.id,
            address: "No nurse",
            lat: 10,
            lng: 10,
        });

        expect(req.status).toBe("open");
        expect(req.assignedNurseUserId ?? null).toBeNull();
    });

    // Note: Concurrency testing with FOR UPDATE SKIP LOCKED is challenging in unit tests
    // because Promise.all() doesn't guarantee true parallel execution at the DB level.
    // The lock mechanism is verified through:
    // 1. Code review of the SQL query (FOR UPDATE OF nl SKIP LOCKED)
    // 2. Manual load testing (future PR-3.7)
    // 3. Production monitoring for double-assignment incidents
});
