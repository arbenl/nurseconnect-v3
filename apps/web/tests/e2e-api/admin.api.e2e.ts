import { db, schema } from "@nurseconnect/database";
import { expect, test } from "@playwright/test";


import { resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

const { requestEvents, serviceRequests } = schema;

test.describe("Admin API", () => {
  test.setTimeout(60000);

  test.beforeEach(async () => {
    await resetDb();
  });

  const endpoints = ["/api/admin/users", "/api/admin/nurses", "/api/admin/requests"];

  for (const endpoint of endpoints) {
    test(`blocks unauthenticated access: ${endpoint}`, async ({ request }) => {
      const response = await request.get(endpoint);
      expect(response.status()).toBe(401);
    });
  }

  for (const endpoint of endpoints) {
    test(`blocks non-admin access: ${endpoint}`, async ({ request }) => {
      const email = `admin-no-${Math.random()}-test.local`;
      await createTestUser(request, email, "No Admin", "patient");
      await loginTestUser(request, email);

      const response = await request.get(endpoint);
      expect(response.status()).toBe(403);
    });
  }

  test("returns users and nurses to admin role", async ({ request }) => {
    const adminEmail = `admin-rbac-${Math.random()}-test.local`;
    await createTestUser(request, adminEmail, "Admin RBAC", "admin");
    await loginTestUser(request, adminEmail);

    const [nurseUser] = await createTestUser(request, `nurse-view-${Math.random()}-test.local`, "Nurse User", "nurse");
    await seedNurse({
      userId: nurseUser!.userId,
      licenseNumber: "RBAC-RB",
      specialization: "General",
      isAvailable: true,
    });

    const usersResponse = await request.get("/api/admin/users");
    expect(usersResponse.ok(), `users failed: ${await usersResponse.text()}`).toBeTruthy();
    const usersBody = await usersResponse.json();
    expect(Array.isArray(usersBody.items)).toBe(true);
    expect(usersBody.items.length).toBeGreaterThanOrEqual(2);

    const nursesResponse = await request.get("/api/admin/nurses");
    expect(nursesResponse.ok(), `nurses failed: ${await nursesResponse.text()}`).toBeTruthy();
    const nursesBody = await nursesResponse.json();
    expect(Array.isArray(nursesBody.items)).toBe(true);
    expect(nursesBody.items.length).toBe(1);
  });

  test("returns admin-readable request detail including event timeline", async ({ request }) => {
    const adminEmail = `admin-detail-${Math.random()}-test.local`;
    await createTestUser(request, adminEmail, "Admin Detail", "admin");
    await loginTestUser(request, adminEmail);

    const [patientUser] = await createTestUser(request, `patient-admin-${Math.random()}-test.local`, "Patient Admin", "patient");
    const [req] = await db
      .insert(serviceRequests)
      .values({
        patientUserId: patientUser!.userId,
        address: "Admin timeline",
        lat: "40.0000",
        lng: "20.0000",
        status: "open",
      })
      .returning();

    await db.insert(requestEvents).values({
      requestId: req!.id,
      type: "request_created",
      actorUserId: patientUser!.userId,
      fromStatus: null,
      toStatus: "open",
    });

    const detailResponse = await request.get(`/api/admin/requests/${req!.id}`);
    expect(detailResponse.ok(), `detail failed: ${await detailResponse.text()}`).toBeTruthy();
    const detail = await detailResponse.json();

    expect(detail.request.id).toBe(req!.id);
    expect(detail.request.status).toBe("open");
    expect(detail.events[0]?.type).toBe("request_created");
  });
});
