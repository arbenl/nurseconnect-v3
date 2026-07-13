import { expect, test, type Page } from "@playwright/test";

import { getDbClient, resetDb, seedNurse, seedNurseLocation } from "../e2e-utils/db";
import { DEFAULT_BRANCH_ID, DEFAULT_ORGANIZATION_ID, createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

async function seedAvailableNurse(
  page: Page,
  email: string,
  lat: string,
  lng: string,
) {
  const { userId } = await createTestUser(page.request, email, "Nurse User", "nurse");
  await markProfileComplete(email, { phone: "555-9000" });
  await seedNurse({
    userId,
    licenseNumber: "RN-REQUEST-001",
    licenseJurisdiction: "XK",
    specialization: "General",
    isAvailable: true,
    status: "verified",
    licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
  });
  await seedNurseLocation({
    nurseUserId: userId,
    lat,
    lng,
  });
  return userId;
}

test.describe("Service Requests", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("patient request assigns to nearest nurse and shows current request details", async ({ page }) => {
    const nearNurseEmail = `near-nurse-${Date.now()}@test.local`;
    const farNurseEmail = `far-nurse-${Date.now()}@test.local`;
    const patientEmail = `patient-${Date.now()}@test.local`;

    const nearNurseId = await seedAvailableNurse(page, nearNurseEmail, "42.6629", "21.1655");
    await seedAvailableNurse(page, farNurseEmail, "40.0000", "20.0000");

    await createTestUser(page.request, patientEmail, "Test Patient", "patient");
    await markProfileComplete(patientEmail, { phone: "555-555-5555" });
    await loginTestUser(page.request, patientEmail);

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Request a Nurse Visit" })).toBeVisible();
    await expect(page.getByLabel("Visit type")).toHaveValue("same_day");
    await page.getByLabel("Address").fill("123 Test St, Pristina");
    await page.getByLabel("Dispatch latitude").fill("42.6629");
    await page.getByLabel("Dispatch longitude").fill("21.1655");
    await page.getByLabel("Care type").fill("Wellness check");

    await page.getByRole("button", { name: "Request Visit" }).click();

    const statusCard = page.getByTestId("patient-request-status-card");
    await expect(statusCard.getByText("Current request status")).toBeVisible({ timeout: 5000 });
    await expect(statusCard.getByText("Assigned to a nurse")).toBeVisible();
    await expect(statusCard.getByText("Wellness check")).toBeVisible();
    await expect(statusCard.getByText("Same day")).toBeVisible();

    const requestsResponse = await page.request.get("/api/requests/mine");
    const requests = await requestsResponse.json();
    expect(requests).toHaveLength(1);

    expect(requests[0].status).toBe("assigned");
    expect(requests[0].assignedNurseUserId).toBe(nearNurseId);
    expect(requests[0].requestType).toBe("same_day");
    expect(requests[0].careType).toBe("Wellness check");
  });

  test("scheduled request reveals scheduling fields and remains open when no nurses are available", async ({
    page,
  }) => {
    const patientEmail = `scheduled-patient-${Date.now()}@test.local`;
    await createTestUser(page.request, patientEmail, "Scheduled Patient", "patient");
    await markProfileComplete(patientEmail, { phone: "555-3000" });
    await loginTestUser(page.request, patientEmail);

    await page.goto("/dashboard");

    await page.getByLabel("Visit type").selectOption("scheduled");
    await expect(page.getByLabel("Scheduled for")).toBeVisible();
    await page.getByLabel("Scheduled for").fill("2026-04-20T09:30");
    await page.getByLabel("Address").fill("456 Remote St");
    await page.getByLabel("Dispatch latitude").fill("42.6629");
    await page.getByLabel("Dispatch longitude").fill("21.1655");
    await page.getByLabel("Care type").fill("Follow-up visit");

    await page.getByRole("button", { name: "Request Visit" }).click();

    const statusCard = page.getByTestId("patient-request-status-card");
    await expect(statusCard.getByText("Waiting for assignment")).toBeVisible({ timeout: 5000 });
    await expect(statusCard.getByText("Scheduled")).toBeVisible();
    await expect(statusCard.getByText("Follow-up visit")).toBeVisible();

    const requestsResponse = await page.request.get("/api/requests/mine");
    const requests = await requestsResponse.json();
    expect(requests).toHaveLength(1);

    expect(requests[0].status).toBe("open");
    expect(requests[0].assignedNurseUserId).toBeNull();
    expect(requests[0].requestType).toBe("scheduled");
    expect(requests[0].scheduledFor).toBeTruthy();
  });

  test("completed requests appear in history instead of being shown as current status", async ({
    page,
  }) => {
    const patientEmail = `history-patient-${Date.now()}@test.local`;
    const { userId: patientUserId } = await createTestUser(
      page.request,
      patientEmail,
      "History Patient",
      "patient",
    );
    await markProfileComplete(patientEmail, { phone: "555-4444" });
    await loginTestUser(page.request, patientEmail);

    const client = getDbClient();
    await client.connect();
    try {
      const result = await client.query<{ id: string }>(
        `INSERT INTO service_requests
          (organization_id, branch_id, patient_user_id, status, address, lat, lng, request_type, care_type, completed_at, created_at, updated_at)
         VALUES
          ($1, $2, $3, 'completed', 'Completed Visit Street', '42.662900', '21.165500', 'same_day', 'Wellness check', NOW(), NOW() - interval '1 hour', NOW())
         RETURNING id`,
        [DEFAULT_ORGANIZATION_ID, DEFAULT_BRANCH_ID, patientUserId],
      );
      const requestId = result.rows[0]!.id;
      await client.query(
        `INSERT INTO service_request_events
          (request_id, organization_id, type, actor_user_id, from_status, to_status, meta, created_at)
         VALUES
          ($1, $2, 'request_created', $3, NULL, 'open', '{}'::jsonb, NOW() - interval '1 hour'),
          ($1, $2, 'request_completed', $3, 'enroute', 'completed', '{}'::jsonb, NOW())`,
        [requestId, DEFAULT_ORGANIZATION_ID, patientUserId],
      );
    } finally {
      await client.end();
    }

    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { name: "Current request status" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Recent request history" })).toBeVisible();
    await expect(page.getByText("Completed Visit Street")).toBeVisible();
    await expect(page.getByText("completed", { exact: true })).toBeVisible();
  });

  test("active request timeline refreshes when the nurse accepts the visit", async ({ page }) => {
    const nurseEmail = `timeline-nurse-${Date.now()}@test.local`;
    const patientEmail = `timeline-patient-${Date.now()}@test.local`;

    const nurseUserId = await seedAvailableNurse(page, nurseEmail, "42.6629", "21.1655");
    await createTestUser(page.request, patientEmail, "Timeline Patient", "patient");
    await markProfileComplete(patientEmail, { phone: "555-1212" });
    await loginTestUser(page.request, patientEmail);

    await page.goto("/dashboard");
    await page.getByLabel("Address").fill("Timeline Street 1");
    await page.getByLabel("Dispatch latitude").fill("42.6629");
    await page.getByLabel("Dispatch longitude").fill("21.1655");
    await page.getByLabel("Care type").fill("Follow-up visit");
    await page.getByRole("button", { name: "Request Visit" }).click();
    await expect(page.getByTestId("patient-request-status-card")).toBeVisible();

    const requestsResponse = await page.request.get("/api/requests/mine");
    const requests = (await requestsResponse.json()) as Array<{ id: string }>;
    const requestId = requests[0]!.id;

    const client = getDbClient();
    await client.connect();
    try {
      await client.query(
        `UPDATE service_requests
            SET status = 'accepted',
                accepted_at = NOW(),
                updated_at = NOW()
          WHERE id = $1`,
        [requestId],
      );
      await client.query(
        `INSERT INTO service_request_events
          (request_id, organization_id, type, actor_user_id, from_status, to_status, meta, created_at)
         VALUES
          ($1, $2, 'request_accepted', $3, 'assigned', 'accepted', '{}'::jsonb, NOW())`,
        [requestId, DEFAULT_ORGANIZATION_ID, nurseUserId],
      );
    } finally {
      await client.end();
    }

    await expect(page.getByRole("heading", { name: "Request timeline" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Nurse accepted the visit")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Accepted by nurse")).toBeVisible({ timeout: 10000 });
  });
});
