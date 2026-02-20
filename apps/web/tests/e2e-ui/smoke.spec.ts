import { test, expect } from "@playwright/test";

test.describe("UI Smoke Tests (Critical Paths + Edge Protect)", () => {
    test("Anonymous navigation to /dashboard redirects to /login", async ({ page }) => {
        // Relying on edge middleware + Layout server session redirects
        await page.goto("/dashboard");

        // We arrive at the Auth login view explicitly dropping anonymous sessions
        await expect(page).toHaveURL(/.*\/login.*/);

        // Ensure the login form rendered to confirm Next.js router functioned properly
        await expect(page.getByText("Sign in to your account")).toBeVisible();
    });

    test("Anonymous navigation to /admin redirects to /login", async ({ page }) => {
        // Additional protected tree validation
        await page.goto("/admin");
        await expect(page).toHaveURL(/.*\/login.*/);
    });

    test("Public home page loads successfully", async ({ page }) => {
        await page.goto("/");
        // Check for the main hero or public branding
        await expect(page.getByRole("heading", { name: /Empowering Healthcare Professionals/i })).toBeVisible();
    });

    test("Public login page loads successfully", async ({ page }) => {
        await page.goto("/login");
        // Verify inputs render avoiding hydration mismatches
        await expect(page.getByLabel(/^Email$/i)).toBeVisible();
        await expect(page.getByLabel(/^Password$/i)).toBeVisible();
    });
});
