import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

import { getDbClient, resetDb, seedNurse } from "../e2e-utils/db";
import { createTestUser, loginTestUser, markProfileComplete } from "../e2e-utils/helpers";

async function seedPatient(page: Page, email: string) {
  await createTestUser(page.request, email, "Patient User", "patient");
  await markProfileComplete(email, { phone: "555-1000" });
}

async function seedVerifiedNurse(page: Page, email: string) {
  const { userId } = await createTestUser(page.request, email, "Nurse User", "nurse");
  await markProfileComplete(email, { phone: "555-2000" });
  await seedNurse({
    userId,
    status: "verified",
    licenseNumber: "RN-UX-001",
    licenseJurisdiction: "XK",
    specialization: "Home Care",
    isAvailable: true,
    licenseValidUntil: new Date(Date.now() + 86_400_000).toISOString(),
  });
}

async function seedAdmin(page: Page, email: string) {
  await createTestUser(page.request, email, "Admin User", "admin");
}

async function seedLaunchOperatorSignals(page: Page) {
  const now = new Date();
  const old = new Date(now.getTime() - 25 * 60_000);
  const patient = await createTestUser(
    page.request,
    `m12-patient-${Date.now()}@test.local`,
    "M12 Patient",
    "patient",
  );
  const nurse = await createTestUser(
    page.request,
    `m12-nurse-${Date.now()}@test.local`,
    "M12 Nurse",
    "nurse",
  );
  await seedNurse({
    userId: nurse.userId,
    status: "verified",
    licenseNumber: "RN-M12-001",
    licenseJurisdiction: "XK",
    specialization: "Home Care",
    isAvailable: true,
    licenseValidUntil: new Date(now.getTime() + 86_400_000).toISOString(),
  });

  const ids = {
    unassigned: randomUUID(),
    staleAssigned: randomUUID(),
    staleEnroute: randomUUID(),
    exception: randomUUID(),
    paymentGap: randomUUID(),
  };
  const client = getDbClient();
  await client.connect();

  try {
    await client.query(
      `INSERT INTO service_requests (
          id,
          patient_user_id,
          assigned_nurse_user_id,
          status,
          address,
          lat,
          lng,
          request_type,
          referral_source,
          assigned_at,
          enroute_at,
          needs_review_at,
          created_at,
          updated_at
        )
        VALUES
          ($1, $6, NULL, 'open', 'M12 Open', '42.662900', '21.165500', 'same_day', 'consumer', NULL, NULL, NULL, $9, $9),
          ($2, $6, $7, 'assigned', 'M12 Assigned', '42.662900', '21.165500', 'same_day', 'consumer', $8, NULL, NULL, $8, $8),
          ($3, $6, $7, 'enroute', 'M12 Enroute', '42.662900', '21.165500', 'same_day', 'consumer', $8, $8, NULL, $8, $8),
          ($4, $6, NULL, 'needs_review', 'M12 Exception', '42.662900', '21.165500', 'same_day', 'consumer', NULL, NULL, $9, $9, $9),
          ($5, $6, $7, 'completed', 'M12 Payment', '42.662900', '21.165500', 'same_day', 'consumer', $8, $8, NULL, $8, $9)`,
      [
        ids.unassigned,
        ids.staleAssigned,
        ids.staleEnroute,
        ids.exception,
        ids.paymentGap,
        patient.userId,
        nurse.userId,
        old,
        now,
      ],
    );
    await client.query(
      `INSERT INTO payment_authorizations (
          request_id,
          patient_user_id,
          status,
          amount_cents,
          currency,
          provider,
          provider_reference,
          authorized_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, 'authorized', 5000, 'EUR', 'manual', 'm12-gap', $3, $3, $3)`,
      [ids.paymentGap, patient.userId, now],
    );
    await client.query(
      `INSERT INTO admin_audit_logs (
          actor_user_id,
          action,
          target_entity_type,
          target_entity_id,
          details,
          created_at
        )
        VALUES
          (NULL, 'payment.authorization.failed', 'request', $1, '{}'::jsonb, $3),
          (NULL, 'payout.failed', 'request', $2, '{}'::jsonb, $3)`,
      [ids.paymentGap, ids.staleAssigned, now],
    );
  } finally {
    await client.end();
  }

  return ids;
}

test.describe("Dashboard UX", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("patient shell removes placeholder navigation and shows patient portal label", async ({
    page,
  }) => {
    const patientEmail = `patient-shell-${Date.now()}@test.local`;
    await seedPatient(page, patientEmail);

    await loginTestUser(page.request, patientEmail);
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
    await expect(page.getByTestId("app-shell-role")).toHaveText("Patient Portal");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(page.getByText("User Details")).toHaveCount(0);
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("nurse shell removes placeholder navigation and shows nurse portal label", async ({
    page,
  }) => {
    const nurseEmail = `nurse-shell-${Date.now()}@test.local`;
    await seedVerifiedNurse(page, nurseEmail);

    await loginTestUser(page.request, nurseEmail);
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
    await expect(page.getByTestId("app-shell-role")).toHaveText("Nurse Portal");
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
    await expect(page.getByText("User Details")).toHaveCount(0);
    await expect(page.locator("pre")).toHaveCount(0);
  });

  test("nurse dashboard copy stays operationally precise", async ({ page }) => {
    const nurseEmail = `nurse-dashboard-${Date.now()}@test.local`;
    await seedVerifiedNurse(page, nurseEmail);

    await loginTestUser(page.request, nurseEmail);
    await page.goto("/dashboard");

    await expect(page.getByText("Dispatch availability")).toBeVisible();
    await expect(page.getByText("Availability does not guarantee an assignment.")).toBeVisible();
    await expect(page.getByText("visible to patients in your area.")).toHaveCount(0);
    await expect(page.getByText("hidden from search results.")).toHaveCount(0);
  });

  test("mobile shell avoids dead bottom-nav links", async ({ page }) => {
    const patientEmail = `patient-mobile-shell-${Date.now()}@test.local`;
    await seedPatient(page, patientEmail);

    await loginTestUser(page.request, patientEmail);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard");

    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
    await expect(page.getByTestId("app-shell-role")).toHaveText("Patient Portal");
    await expect(page.getByRole("link", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test("profile page edits patient details through the live profile API", async ({ page }) => {
    const patientEmail = `patient-profile-${Date.now()}@test.local`;
    await seedPatient(page, patientEmail);

    await loginTestUser(page.request, patientEmail);
    await page.goto("/dashboard/profile");

    await page.getByLabel("First name").fill("Ada");
    await page.getByLabel("Last name").fill("Lovelace");
    await page.getByLabel("Phone").fill("+49 555 222");
    await page.getByLabel("City").fill("Berlin");
    await page.getByLabel("Address").fill("42 Example Street");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Profile saved.")).toBeVisible();

    const meResponse = await page.request.get("/api/me");
    const me = await meResponse.json();
    expect(me.user.profile.firstName).toBe("Ada");
    expect(me.user.profile.lastName).toBe("Lovelace");
    expect(me.user.profile.phone).toBe("+49 555 222");
    expect(me.user.profile.city).toBe("Berlin");
    expect(me.user.profile.address).toBe("42 Example Street");
  });

  test("admin dashboard uses readable section cards instead of inline dark blocks", async ({
    page,
  }) => {
    const adminEmail = `admin-dashboard-${Date.now()}@test.local`;
    await seedAdmin(page, adminEmail);
    const signalIds = await seedLaunchOperatorSignals(page);

    await loginTestUser(page.request, adminEmail);
    await page.goto("/admin");

    await expect(page.getByTestId("admin-shell")).toBeVisible();
    expect(await page.getByTestId("admin-section-card").count()).toBeGreaterThanOrEqual(6);
    await expect(page.getByRole("heading", { name: "Operations Console" })).toBeVisible();
    const launchSignals = page.getByTestId("admin-section-card").filter({
      has: page.getByRole("heading", { name: "Launch operator signals" }),
    });
    await expect(launchSignals).toBeVisible();
    await expect(launchSignals.getByText("Launch prerequisites")).toBeVisible();
    await expect(launchSignals.getByText("Dispatch attention")).toBeVisible();
    await expect(launchSignals.getByText("Payment follow-up")).toBeVisible();
    await expect(launchSignals.getByText("3 active areas", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 verified available", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 unassigned", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 stale assigned", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 stale enroute", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 exception", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 auth no payout", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 auth failed", { exact: true })).toBeVisible();
    await expect(launchSignals.getByText("1 payout failed", { exact: true })).toBeVisible();
    await expect(
      launchSignals.getByRole("link", {
        name: new RegExp(`Auth without payout.*${signalIds.paymentGap.slice(0, 8)}`),
      }),
    ).toBeVisible();
    await expect(
      launchSignals.getByRole("link", {
        name: new RegExp(`Authorization failed.*${signalIds.paymentGap.slice(0, 8)}`),
      }),
    ).toBeVisible();
    await expect(
      launchSignals.getByRole("link", {
        name: new RegExp(`Payout failed.*${signalIds.staleAssigned.slice(0, 8)}`),
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Immediate attention" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Credential review queue" })).toBeVisible();
    await expect(page.locator('[style*="#0a0a0a"]')).toHaveCount(0);
  });

  test("admin shell keeps the active queue readable", async ({ page }) => {
    const adminEmail = `admin-queue-${Date.now()}@test.local`;
    await seedAdmin(page, adminEmail);

    await loginTestUser(page.request, adminEmail);
    await page.goto("/admin/requests");

    await expect(page.getByTestId("admin-shell")).toBeVisible();
    expect(await page.getByTestId("admin-section-card").count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByRole("heading", { name: "Active Requests Queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Filters" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Queue snapshot" })).toBeVisible();
    await expect(page.locator('[style*="#111"]')).toHaveCount(0);
  });
});
