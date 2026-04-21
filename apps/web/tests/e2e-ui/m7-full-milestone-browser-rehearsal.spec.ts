import type { Page } from "@playwright/test";

import { TEST_PASSWORD } from "../e2e-utils/helpers";
import { expect, test } from "./m7-milestone-rehearsal.fixtures";

async function replaceInputValue(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(value);
  await expect(input).toHaveValue(value);
}

async function loginThroughUi(page: Page, email: string, destinationPath: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Sign in to your account")).toBeVisible();
  const emailInput = page.locator("#email");
  const passwordInput = page.locator("#password");
  await emailInput.click();
  await page.keyboard.type(email);
  await expect(emailInput).toHaveValue(email);
  await passwordInput.click();
  await page.keyboard.type(TEST_PASSWORD);
  await expect(passwordInput).toHaveValue(TEST_PASSWORD);
  const signInResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/sign-in/email") &&
      response.request().method() === "POST",
    { timeout: 15000 },
  );
  await page.getByRole("button", { name: "Sign In" }).click();
  const response = await signInResponse;
  const responseText = await response.text();
  expect(response.ok(), `UI login failed for ${email}: ${responseText}`).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${destinationPath}$`), { timeout: 20000 });
}

async function logoutThroughUi(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
}

test.describe("M7 Full Milestone Browser Rehearsal", () => {
  test.setTimeout(420000);

  test("rehearses M1-M6 as one continuous browser journey", async ({
    page,
    milestoneState,
  }) => {
    let patientRequestId = "";
    let partnerRequestId = "";

    await test.step("M0/M5/M6: readiness preconditions and admin browser entry", async () => {
      const healthResponse = await page.request.get("/api/health/db");
      expect(healthResponse.ok(), `Health check failed: ${await healthResponse.text()}`).toBeTruthy();
      await expect(healthResponse.json()).resolves.toEqual({ ok: true, db: "ok" });

      await loginThroughUi(page, milestoneState.adminEmail, "/admin");
      await expect(page.getByRole("heading", { name: "Operations Console" })).toBeVisible();
      await expect(page.getByRole("navigation").getByRole("link", { name: "Service Areas" })).toBeVisible();
      await expect(page.getByRole("navigation").getByRole("link", { name: "Exception Queue" })).toBeVisible();
    });

    await test.step("M4: service area controls and in-area dispatch visibility", async () => {
      await page.goto("/admin/service-areas", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Service Areas" })).toBeVisible();
      await expect(page.getByText("Pristina Test Coverage").first()).toBeVisible();
      await expect(page.getByText("active").first()).toBeVisible();
    });

    await test.step("M4: patient creates in-area demand through browser UI", async () => {
      await logoutThroughUi(page);
      await loginThroughUi(page, milestoneState.patientEmail, "/dashboard");

      await expect(page.getByRole("heading", { name: "Request a Nurse Visit" })).toBeVisible();
      await page.getByLabel("Address").fill(`M7 Patient Request ${milestoneState.suffix}, Pristina`);
      await page.getByLabel("Dispatch latitude").fill("42.6629");
      await page.getByLabel("Dispatch longitude").fill("21.1655");
      await page.getByLabel("Care type").fill("M7 wellness check");

      const createRequestResponse = page.waitForResponse((response) =>
        response.url().endsWith("/api/requests") &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Request Visit" }).click();
      const createdResponse = await createRequestResponse;
      expect(createdResponse.ok(), `Patient request failed: ${await createdResponse.text()}`).toBeTruthy();
      const created = await createdResponse.json();
      patientRequestId = created.id as string;
      expect(created.assignedNurseUserId).toBe(milestoneState.nurseUserId);

      const statusCard = page.getByTestId("patient-request-status-card");
      await expect(statusCard.getByText("Assigned to a nurse")).toBeVisible({ timeout: 10000 });
      await expect(statusCard.getByText("M7 wellness check")).toBeVisible();
      await expect(page.getByTestId("patient-request-timeline").getByText("Request created")).toBeVisible();
    });

    await test.step("M4: nurse accepts, goes enroute, and completes the assigned visit", async () => {
      await logoutThroughUi(page);
      await loginThroughUi(page, milestoneState.nurseEmail, "/dashboard");

      const assignmentCard = page.getByTestId("nurse-assignment-card");
      await expect(assignmentCard.getByText(`M7 Patient Request ${milestoneState.suffix}`)).toBeVisible({
        timeout: 10000,
      });

      const acceptResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/requests/${patientRequestId}/accept`) &&
        response.request().method() === "POST",
      );
      await assignmentCard.getByRole("button", { name: "Accept" }).click();
      expect((await acceptResponse).ok()).toBeTruthy();
      await expect(assignmentCard.getByText("accepted")).toBeVisible({ timeout: 10000 });

      const enrouteResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/requests/${patientRequestId}/enroute`) &&
        response.request().method() === "POST",
      );
      await assignmentCard.getByRole("button", { name: "Mark En Route" }).click();
      expect((await enrouteResponse).ok()).toBeTruthy();
      await expect(assignmentCard.getByText("enroute")).toBeVisible({ timeout: 10000 });

      const completeResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/requests/${patientRequestId}/complete`) &&
        response.request().method() === "POST",
      );
      await assignmentCard.getByRole("button", { name: "Mark Complete" }).click();
      expect((await completeResponse).ok()).toBeTruthy();
      await expect(assignmentCard.getByText("No active visit right now")).toBeVisible({ timeout: 10000 });
      await expect(assignmentCard.getByText("M7 wellness check")).toBeVisible();
    });

    await test.step("M3: admin records private-pay authorization and nurse payout trace", async () => {
      await logoutThroughUi(page);
      await loginThroughUi(page, milestoneState.adminEmail, "/admin");
      await page.goto(`/admin/requests/${patientRequestId}`, { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Request Detail" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Payment Trace" })).toBeVisible();
      await expect(page.getByText("request_completed")).toBeVisible();

      await page.locator("#auth-amount").fill("150.00");
      await page.locator("#auth-currency").fill("USD");
      await page.locator("#auth-provider").fill("manual");
      await page.locator("#auth-reference").fill(`m7-auth-${milestoneState.suffix}`);
      const recordAuthorization = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${patientRequestId}/payments`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Record Authorization" }).click();
      const recordAuthorizationResponse = await recordAuthorization;
      expect(
        recordAuthorizationResponse.ok(),
        `Authorization record failed: ${await recordAuthorizationResponse.text()}`,
      ).toBeTruthy();
      await expect(page.getByText("authorized", { exact: true })).toBeVisible({ timeout: 10000 });

      await page.locator("#auth-status-reference").fill(`m7-capture-${milestoneState.suffix}`);
      const captureAuthorization = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${patientRequestId}/payments`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Capture" }).click();
      const captureAuthorizationResponse = await captureAuthorization;
      expect(
        captureAuthorizationResponse.ok(),
        `Authorization capture failed: ${await captureAuthorizationResponse.text()}`,
      ).toBeTruthy();
      await expect(page.getByText("captured", { exact: true })).toBeVisible({ timeout: 10000 });

      await page.locator("#payout-amount").fill("90.00");
      await page.locator("#payout-currency").fill("USD");
      await page.locator("#payout-provider").fill("manual");
      await page.locator("#payout-reference").fill(`m7-payout-${milestoneState.suffix}`);
      const recordPayout = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${patientRequestId}/payments`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Record Payout Owed" }).click();
      const recordPayoutResponse = await recordPayout;
      expect(recordPayoutResponse.ok(), `Payout record failed: ${await recordPayoutResponse.text()}`).toBeTruthy();
      await expect(page.getByText("owed", { exact: true })).toBeVisible({ timeout: 10000 });

      await page.locator("#payout-status-reference").fill(`m7-paid-${milestoneState.suffix}`);
      const markPaid = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${patientRequestId}/payments`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Mark Paid" }).click();
      const markPaidResponse = await markPaid;
      expect(markPaidResponse.ok(), `Payout mark-paid failed: ${await markPaidResponse.text()}`).toBeTruthy();
      await expect(page.getByText("paid", { exact: true })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(`m7-paid-${milestoneState.suffix}`)).toBeVisible();
    });

    await test.step("M1: referral partner submits and views a partner-scoped request", async () => {
      await logoutThroughUi(page);
      await loginThroughUi(page, milestoneState.partnerEmail, "/partner");

      await expect(page.getByTestId("app-shell-role")).toHaveText("Partner Portal");
      await expect(page.getByRole("heading", { name: "Submit a patient referral" })).toBeVisible();
      await replaceInputValue(page, "[aria-label='Patient email']", `m7-referred-${milestoneState.suffix}@example.com`);
      await replaceInputValue(page, "[aria-label='Patient first name']", "M7");
      await replaceInputValue(page, "[aria-label='Patient last name']", "Referral");
      await replaceInputValue(page, "[aria-label='Patient phone']", "+38344111777");
      await replaceInputValue(page, "[aria-label='Patient city']", "Pristina");
      await replaceInputValue(page, "[aria-label='Visit address']", `M7 Partner Request ${milestoneState.suffix}, Pristina`);
      await replaceInputValue(page, "[aria-label='Care type']", "M7 partner wound care");

      const partnerCreateResponse = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/partner/requests") &&
          response.request().method() === "POST",
        { timeout: 15000 },
      );
      await page.getByRole("button", { name: "Submit Referral" }).click();
      const partnerCreated = await partnerCreateResponse;
      expect(partnerCreated.ok(), `Partner request failed: ${await partnerCreated.text()}`).toBeTruthy();
      const partnerPayload = await partnerCreated.json();
      partnerRequestId = partnerPayload.id as string;
      expect(partnerPayload.referralPartnerId).toBe(milestoneState.partnerUserId);

      await expect(page.getByText("M7 Referral")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(`M7 Partner Request ${milestoneState.suffix}`)).toBeVisible();
      await page.getByRole("link", { name: /M7 Referral/ }).click();
      await expect(page).toHaveURL(new RegExp(`/partner/requests/${partnerRequestId}$`));
      await expect(page.getByText("Referral Detail")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("M7 partner wound care")).toBeVisible();
    });

    await test.step("M2: admin moves partner demand through exception triage and reopens", async () => {
      await logoutThroughUi(page);
      await loginThroughUi(page, milestoneState.adminEmail, "/admin");
      await page.goto(`/admin/requests/${partnerRequestId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Request Detail" })).toBeVisible();
      await expect(page.getByText("M7 partner wound care")).toBeVisible();

      const needsReviewResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${partnerRequestId}/triage`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Mark Needs Review" }).click();
      const needsReviewResult = await needsReviewResponse;
      expect(needsReviewResult.ok(), `Needs-review triage failed: ${await needsReviewResult.text()}`).toBeTruthy();
      await expect(page.getByText("Request moved to exception review.")).toBeVisible({ timeout: 10000 });

      await page.goto("/admin/requests/exceptions", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Exception Queue" })).toBeVisible();
      let exceptionRow = page.getByTestId(`exception-request-row-${partnerRequestId}`);
      await expect(exceptionRow).toBeVisible();
      await expect(exceptionRow.getByText("needs review", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: partnerRequestId }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/requests/${partnerRequestId}$`));

      await page.locator("#triage-reason").fill("M7 declined with documented operator reason");
      const declineResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${partnerRequestId}/triage`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Decline Request" }).click();
      const declineResult = await declineResponse;
      expect(declineResult.ok(), `Decline triage failed: ${await declineResult.text()}`).toBeTruthy();
      await expect(page.getByText("Request declined.")).toBeVisible({ timeout: 10000 });

      await page.goto("/admin/requests/exceptions", { waitUntil: "domcontentloaded" });
      exceptionRow = page.getByTestId(`exception-request-row-${partnerRequestId}`);
      await expect(exceptionRow).toBeVisible();
      await expect(exceptionRow.getByText("declined", { exact: true })).toBeVisible();
      await page.getByRole("link", { name: partnerRequestId }).click();

      await page.locator("#triage-reason").fill("M7 reopened for dispatch re-entry");
      const reopenResponse = page.waitForResponse((response) =>
        response.url().endsWith(`/api/admin/requests/${partnerRequestId}/triage`) &&
        response.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Reopen Request" }).click();
      const reopenResult = await reopenResponse;
      expect(reopenResult.ok(), `Reopen triage failed: ${await reopenResult.text()}`).toBeTruthy();
      await expect(page.getByText("Request reopened.")).toBeVisible({ timeout: 10000 });
      const summary = page.getByTestId("request-summary");
      await expect(summary.getByText("open")).toBeVisible();
      await expect(summary.getByText("unassigned")).toBeVisible();
    });

    await test.step("Final: admin evidence surfaces show milestone continuity", async () => {
      await page.goto(`/admin/requests/${patientRequestId}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText("request_created")).toBeVisible();
      await expect(page.getByText("request_assigned")).toBeVisible();
      await expect(page.getByText("request_accepted")).toBeVisible();
      await expect(page.getByText("request_enroute")).toBeVisible();
      await expect(page.getByText("request_completed")).toBeVisible();
      await expect(page.getByText("captured", { exact: true })).toBeVisible();
      await expect(page.getByText("paid", { exact: true })).toBeVisible();

      await page.goto("/admin/requests", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Active Requests Queue" })).toBeVisible();
      const activeRow = page.getByTestId(`active-request-row-${partnerRequestId}`);
      await expect(activeRow).toBeVisible();
      await expect(activeRow.getByText("partner", { exact: true })).toBeVisible();
    });
  });
});
