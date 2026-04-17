import { expect, test } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser } from "../e2e-utils/helpers";

test.describe("/api/me/profile", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("patching /api/me/profile persists base fields and returns profileComplete true for a patient", async ({
    request,
  }) => {
    const email = `me-profile-patient-${Date.now()}@test.local`;
    await createTestUser(request, email, "Profile Patient", "patient");
    await loginTestUser(request, email);

    const patchResponse = await request.patch("/api/me/profile", {
      data: {
        firstName: "Pat",
        lastName: "Ient",
        phone: "+38344123456",
        city: "Pristina",
        address: "Main Street 1",
      },
    });
    expect(patchResponse.ok(), `Profile patch failed: ${await patchResponse.text()}`).toBeTruthy();

    const meResponse = await request.get("/api/me");
    expect(meResponse.ok(), `GET /api/me failed: ${await meResponse.text()}`).toBeTruthy();
    await expect(meResponse.json()).resolves.toMatchObject({
      ok: true,
      user: {
        role: "patient",
        profileComplete: true,
        profile: {
          firstName: "Pat",
          lastName: "Ient",
          phone: "+38344123456",
          city: "Pristina",
          address: "Main Street 1",
        },
      },
    });

    const client = getDbClient();
    await client.connect();
    try {
      const result = await client.query<{ profile_completed_at: Date | null }>(
        "SELECT profile_completed_at FROM users WHERE email = $1",
        [email],
      );
      expect(result.rows[0]?.profile_completed_at).toBeTruthy();
    } finally {
      await client.end();
    }
  });

  test("a nurse can have base profile complete while derived /api/me profileComplete stays false until nurse fields exist", async ({
    request,
  }) => {
    const email = `me-profile-nurse-${Date.now()}@test.local`;
    const { userId } = await createTestUser(request, email, "Profile Nurse", "nurse");
    await seedNurse({
      userId,
      licenseNumber: "",
      specialization: "",
      isAvailable: false,
      status: "draft",
      licenseJurisdiction: "CA",
      licenseValidUntil: null,
    });
    await loginTestUser(request, email);

    const patchResponse = await request.patch("/api/me/profile", {
      data: {
        firstName: "Nora",
        lastName: "Nurse",
        phone: "+38344123457",
        city: "Pristina",
        address: "Hospital Row 2",
      },
    });
    expect(patchResponse.ok(), `Profile patch failed: ${await patchResponse.text()}`).toBeTruthy();

    const meResponse = await request.get("/api/me");
    expect(meResponse.ok(), `GET /api/me failed: ${await meResponse.text()}`).toBeTruthy();
    await expect(meResponse.json()).resolves.toMatchObject({
      ok: true,
      user: {
        role: "nurse",
        profileComplete: false,
      },
    });
  });
});
