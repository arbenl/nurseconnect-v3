import { expect, test } from "@playwright/test";

import { resetDb } from "../e2e-utils/db";
import { createTestUser, markProfileComplete } from "../e2e-utils/helpers";

test.describe("Authentication", () => {
  test.beforeEach(async () => {
    await resetDb();
  });

  test("patient signup redirects to onboarding", async ({ page }) => {
    await page.goto("/signup");

    const email = `patient-${Date.now()}@test.local`;
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByLabel("Name").fill("Test Patient");
    await page.getByRole("button", { name: /sign up/i }).click();

    await page.waitForURL(/\/(onboarding|dashboard)/);

    if (page.url().includes("/dashboard")) {
      await page.waitForURL("/onboarding");
    }

    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("existing user can login", async ({ page }) => {
    const email = `existing-${Date.now()}@test.local`;
    const password = "password123";
    const name = "Existing User";

    const signUpResponse = await page.request.post("/api/auth/sign-up/email", {
      data: {
        email,
        password,
        name,
      },
    });
    expect(signUpResponse.ok()).toBeTruthy();

    await page.request.post("/api/auth/sign-out", { data: {} });

    const loginResponse = await page.request.post("/api/auth/sign-in/email", {
      data: {
        email,
        password,
      },
    });

    expect(loginResponse.ok()).toBeTruthy();

    const meResponse = await page.request.get("/api/me");
    expect(meResponse.ok()).toBeTruthy();
    const meData = await meResponse.json();

    expect(meData.user).toBeTruthy();
    expect(meData.user.email).toBe(email);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("admin user ignores wrong-portal callback and lands in admin", async ({ page }) => {
    const email = `admin-${Date.now()}@test.local`;
    const password = "password123";

    await createTestUser(page.request, email, "Admin User", "admin");

    await page.goto("/login?callbackUrl=/dashboard");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/admin$/);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  });

  test("patient keeps a safe dashboard callback after login", async ({ page }) => {
    const email = `patient-callback-${Date.now()}@test.local`;
    const password = "password123";

    await createTestUser(page.request, email, "Callback Patient", "patient");
    await markProfileComplete(email, { phone: "555-1111" });

    await page.goto("/login?callbackUrl=/dashboard/profile");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await page.waitForURL(/\/dashboard\/profile$/);
    await expect(page).toHaveURL(/\/dashboard\/profile$/);
    await expect(page.getByRole("heading", { name: /update profile/i })).toBeVisible();
  });

  test("patient visiting admin is redirected back to dashboard", async ({ page }) => {
    const email = `patient-portal-${Date.now()}@test.local`;
    const password = "password123";

    await createTestUser(page.request, email, "Portal Patient", "patient");
    await markProfileComplete(email, { phone: "555-2222" });
    await page.request.post("/api/auth/sign-in/email", {
      data: { email, password },
    });

    await page.goto("/admin");

    await page.waitForURL(/\/dashboard$/);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByTestId("dashboard-ready")).toBeVisible();
  });
});
