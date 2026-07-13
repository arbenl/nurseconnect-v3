import { db, schema, sql } from "@nurseconnect/database";
import { bootstrapDefaultOrganizationMemberships } from "@nurseconnect/domain-identity";
import { RequestCreationValidationError } from "@nurseconnect/domain-request";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createAndAssignRequest } from "./allocate-request";

const { users, nurses, nurseLocations, serviceAreas, serviceRequests } = schema;

function uuidLike(id: string) {
    expect(id).toMatch(/^[0-9a-f-]{20,}$/i);
}

async function seedServiceAreas() {
    const [originArea, noNurseArea] = await db
        .insert(serviceAreas)
        .values([
            {
                label: "Origin Test Area",
                centerLat: "0.000000",
                centerLng: "0.000000",
                radiusMeters: 200000,
                status: "active",
            },
            {
                label: "No Nurse Test Area",
                centerLat: "10.000000",
                centerLng: "10.000000",
                radiusMeters: 200000,
                status: "active",
            },
        ])
        .returning();

    return { originArea: originArea!, noNurseArea: noNurseArea! };
}

describe.sequential("createAndAssignRequest", () => {
    beforeAll(async () => {
        await db.execute(sql`SELECT 1`);
    });

    beforeEach(async () => {
        await db.execute(sql`TRUNCATE TABLE service_request_events RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE service_requests RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE nurse_locations RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE nurses RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE service_areas RESTART IDENTITY CASCADE`);
        await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`);
        await bootstrapDefaultOrganizationMemberships();
    });

    it("assigns the nearest available nurse", async () => {
        const { originArea } = await seedServiceAreas();

        const [patient] = await db
            .insert(users)
            .values({
                email: "p1@test.local",
                role: "patient",
            })
            .returning();

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
            serviceAreaId: originArea.id,
        });

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
            serviceAreaId: originArea.id,
        });

        const req = await createAndAssignRequest({
            patientUserId: patient!.id,
            address: "Somewhere",
            lat: 0,
            lng: 0,
        });

        uuidLike(req.id);
        expect(req).not.toHaveProperty("organizationId");
        expect(req.patientUserId).toBe(patient!.id);
        expect(req.serviceAreaId).toBe(originArea.id);
        expect(req.status).toBe("assigned");
        expect(req.assignedNurseUserId).toBe(nurseAUser!.id);
    });

    it("marks the chosen nurse unavailable before the next request is matched", async () => {
        const { originArea } = await seedServiceAreas();

        const [firstPatient] = await db
            .insert(users)
            .values({
                email: "p-auto-1@test.local",
                role: "patient",
            })
            .returning();

        const [secondPatient] = await db
            .insert(users)
            .values({
                email: "p-auto-2@test.local",
                role: "patient",
            })
            .returning();

        const [nurseAUser] = await db
            .insert(users)
            .values({
                email: "nurse-auto-a@test.local",
                role: "nurse",
            })
            .returning();

        await db.insert(nurses).values({
            userId: nurseAUser!.id,
            status: "verified",
            isAvailable: true,
            licenseNumber: "AUTO-A",
            specialization: "general",
        });

        await db.insert(nurseLocations).values({
            nurseUserId: nurseAUser!.id,
            lat: "0.000000",
            lng: "0.000000",
            serviceAreaId: originArea.id,
        });

        const [nurseBUser] = await db
            .insert(users)
            .values({
                email: "nurse-auto-b@test.local",
                role: "nurse",
            })
            .returning();

        await db.insert(nurses).values({
            userId: nurseBUser!.id,
            status: "verified",
            isAvailable: true,
            licenseNumber: "AUTO-B",
            specialization: "general",
        });

        await db.insert(nurseLocations).values({
            nurseUserId: nurseBUser!.id,
            lat: "1.000000",
            lng: "1.000000",
            serviceAreaId: originArea.id,
        });

        const firstRequest = await createAndAssignRequest({
            patientUserId: firstPatient!.id,
            address: "First request",
            lat: 0,
            lng: 0,
        });

        expect(firstRequest.status).toBe("assigned");
        expect(firstRequest.assignedNurseUserId).toBe(nurseAUser!.id);

        const secondRequest = await createAndAssignRequest({
            patientUserId: secondPatient!.id,
            address: "Second request",
            lat: 0,
            lng: 0,
        });

        expect(secondRequest.status).toBe("assigned");
        expect(secondRequest.assignedNurseUserId).toBe(nurseBUser!.id);

        const nurseStates = await db
            .select({
                userId: nurses.userId,
                isAvailable: nurses.isAvailable,
            })
            .from(nurses)
            .orderBy(nurses.userId);

        expect(nurseStates).toEqual(
            expect.arrayContaining([
                {
                    userId: nurseAUser!.id,
                    isAvailable: false,
                },
                {
                    userId: nurseBUser!.id,
                    isAvailable: false,
                },
            ])
        );
    });

    it("leaves request open if no nurses are available", async () => {
        const { noNurseArea } = await seedServiceAreas();

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
        expect(req.serviceAreaId).toBe(noNurseArea.id);
    });

    it("rejects invalid request-type and scheduledFor combinations before persistence", async () => {
        await seedServiceAreas();

        const [patient] = await db
            .insert(users)
            .values({ email: "p-invalid-shape@test.local", role: "patient" })
            .returning();

        await expect(
            createAndAssignRequest({
                patientUserId: patient!.id,
                address: "Scheduled without time",
                lat: 0,
                lng: 0,
                requestType: "scheduled",
            })
        ).rejects.toThrow(RequestCreationValidationError);
        await expect(
            createAndAssignRequest({
                patientUserId: patient!.id,
                address: "Scheduled without time",
                lat: 0,
                lng: 0,
                requestType: "scheduled",
            })
        ).rejects.toThrow("scheduledFor is required for scheduled requests");

        await expect(
            createAndAssignRequest({
                patientUserId: patient!.id,
                address: "Same day with time",
                lat: 0,
                lng: 0,
                requestType: "same_day",
                scheduledFor: "2027-01-01T10:00:00.000Z",
            })
        ).rejects.toThrow(RequestCreationValidationError);
        await expect(
            createAndAssignRequest({
                patientUserId: patient!.id,
                address: "Same day with time",
                lat: 0,
                lng: 0,
                requestType: "same_day",
                scheduledFor: "2027-01-01T10:00:00.000Z",
            })
        ).rejects.toThrow("scheduledFor must be omitted for same-day requests");

        const persistedRequests = await db.select().from(serviceRequests);

        expect(persistedRequests).toHaveLength(0);
    });

    it("rejects request creation outside all active service areas before persistence", async () => {
        await seedServiceAreas();
        const [patient] = await db
            .insert(users)
            .values({ email: "p-outside-service-area@test.local", role: "patient" })
            .returning();

        await expect(
            createAndAssignRequest({
                patientUserId: patient!.id,
                address: "Outside operating area",
                lat: 45,
                lng: 45,
            })
        ).rejects.toThrow(RequestCreationValidationError);
        await expect(
            createAndAssignRequest({
                patientUserId: patient!.id,
                address: "Outside operating area",
                lat: 45,
                lng: 45,
            })
        ).rejects.toThrow("Request location is outside all active service areas");

        const persistedRequests = await db.select().from(serviceRequests);

        expect(persistedRequests).toHaveLength(0);
    });

    it("does not assign a verified nurse record when the linked user is not in the nurse role", async () => {
        const { originArea } = await seedServiceAreas();

        const [patient] = await db
            .insert(users)
            .values({ email: "p3@test.local", role: "patient" })
            .returning();

        const [nonNurseUser] = await db
            .insert(users)
            .values({
                email: "not-a-nurse@test.local",
                role: "patient",
            })
            .returning();

        await db.insert(nurses).values({
            userId: nonNurseUser!.id,
            status: "verified",
            isAvailable: true,
            licenseNumber: "PATIENT-ROW",
            specialization: "general",
        });

        await db.insert(nurseLocations).values({
            nurseUserId: nonNurseUser!.id,
            lat: "0.000000",
            lng: "0.000000",
            serviceAreaId: originArea.id,
        });

        const req = await createAndAssignRequest({
            patientUserId: patient!.id,
            address: "Role mismatch",
            lat: 0,
            lng: 0,
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
