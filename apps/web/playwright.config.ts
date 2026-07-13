import { defineConfig, devices } from "@playwright/test";
import { closeSync, mkdirSync, openSync } from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import path from "path";

// Load .env.local if present
dotenv.config({ path: path.resolve(__dirname, ".env.local") });

const launchSlowMoMs = Number(process.env.PLAYWRIGHT_SLOW_MO_MS ?? "0");
const observationDir = path.resolve(__dirname, "../../artifacts/playwright/tenant-observation");
const observationRun = `pw-${randomUUID()}`;
const observationFile = path.join(observationDir, `${observationRun}.jsonl`);
const observationSummary = path.join(observationDir, `${observationRun}.summary.json`);
mkdirSync(observationDir, { recursive: true });
closeSync(openSync(observationFile, "wx"));
process.env.TENANT_SCOPE_OBSERVATION_RUN = observationRun;
process.env.TENANT_SCOPE_VIOLATION_FILE = observationFile;
process.env.TENANT_SCOPE_OBSERVATION_SUMMARY = observationSummary;
const launchOptions =
    Number.isFinite(launchSlowMoMs) && launchSlowMoMs > 0
        ? { slowMo: launchSlowMoMs }
        : undefined;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: "./tests",
    outputDir: path.resolve(__dirname, "../../artifacts/playwright/test-results"),
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [
        ["line"],
        ["html", { outputFolder: path.resolve(__dirname, "../../artifacts/playwright/report"), open: "never" }],
    ],
    globalTeardown: path.resolve(__dirname, "tests/tenant-observation-global-teardown.ts"),
    use: {
        baseURL: "http://localhost:3010",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        launchOptions,
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
        env: {
            TENANT_SCOPE_OBSERVATION_RUN: observationRun,
            TENANT_SCOPE_VIOLATION_FILE: observationFile,
        },
        url: "http://localhost:3010/",
        reuseExistingServer: false,
        timeout: 120 * 1000,
    },
});
