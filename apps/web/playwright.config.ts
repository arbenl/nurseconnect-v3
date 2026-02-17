import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.local if present
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: "html",
    use: {
        baseURL: "http://localhost:3010",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        extraHTTPHeaders: {
            "Origin": "http://localhost:3010",
        },
    },

    projects: [
        {
            name: "api",
            testDir: "./tests/e2e-api",
            testMatch: "**/*.e2e.ts",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "ui",
            testDir: "./tests/e2e-ui",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    webServer: {
        command: "PORT=3010 E2E_TEST_MODE=1 pnpm dev",
        url: "http://localhost:3010/",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
    },
});
