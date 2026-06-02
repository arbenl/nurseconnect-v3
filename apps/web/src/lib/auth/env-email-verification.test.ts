import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function stubRequiredEnv(overrides: Record<string, string | undefined> = {}) {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/nurseconnect_test");
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "off");
  vi.stubEnv("EMAIL_PROVIDER", "disabled");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("POSTMARK_SERVER_TOKEN", "");

  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
}

describe("env email verification wiring", () => {
  beforeEach(() => {
    vi.resetModules();
    stubRequiredEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads with empty email verification placeholders when verification is off", async () => {
    const { env } = await import("../../env");

    expect(env).toBeDefined();
  });

  it("rejects production runtime off mode through the env module", async () => {
    vi.resetModules();
    stubRequiredEnv({
      NODE_ENV: "production",
      APP_URL: "https://nurseconnect.example",
      NC_EMAIL_VERIFICATION_MODE: "off",
    });

    await expect(import("../../env")).rejects.toThrow(
      "NC_EMAIL_VERIFICATION_MODE=off is not allowed in production",
    );
  });
});
