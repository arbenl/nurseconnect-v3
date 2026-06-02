import { describe, expect, it } from "vitest";

import { resolveEmailVerificationConfig } from "./email-verification-config";

const baseEnv = {
  NODE_ENV: "development",
  APP_URL: "http://localhost:3010",
  BETTER_AUTH_SECRET: "test-secret",
};

describe("email verification config", () => {
  it("defaults to disabled local mode", () => {
    const config = resolveEmailVerificationConfig(baseEnv);

    expect(config.mode).toBe("off");
    expect(config.provider).toBe("disabled");
    expect(config.appUrl).toBe("http://localhost:3010");
  });

  it("treats empty placeholder values as unset", () => {
    const config = resolveEmailVerificationConfig({
      ...baseEnv,
      APP_URL: "",
      BETTER_AUTH_URL: "",
      EMAIL_FROM: "",
      POSTMARK_SERVER_TOKEN: "",
    });

    expect(config).toMatchObject({
      mode: "off",
      provider: "disabled",
      appUrl: "http://localhost:3010",
    });
  });

  it("falls back to Better Auth or deployment URLs when APP_URL is empty", () => {
    expect(
      resolveEmailVerificationConfig({
        ...baseEnv,
        APP_URL: "",
        BETTER_AUTH_URL: "https://auth.nurseconnect.example",
      }).appUrl,
    ).toBe("https://auth.nurseconnect.example");

    expect(
      resolveEmailVerificationConfig({
        ...baseEnv,
        APP_URL: "",
        VERCEL_URL: "preview.nurseconnect.example",
      }).appUrl,
    ).toBe("https://preview.nurseconnect.example");
  });

  it("rejects off mode in production", () => {
    expect(() =>
      resolveEmailVerificationConfig({
        ...baseEnv,
        NODE_ENV: "production",
        APP_URL: "https://nurseconnect.example",
        NC_EMAIL_VERIFICATION_MODE: "off",
      }),
    ).toThrow("NC_EMAIL_VERIFICATION_MODE=off is not allowed in production");
  });

  it("allows production build phase without runtime email provider secrets", () => {
    const config = resolveEmailVerificationConfig({
      ...baseEnv,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
      NC_EMAIL_VERIFICATION_MODE: "off",
    });

    expect(config.mode).toBe("off");
  });

  it("rejects fake providers in production observe mode", () => {
    expect(() =>
      resolveEmailVerificationConfig({
        ...baseEnv,
        NODE_ENV: "production",
        APP_URL: "https://nurseconnect.example",
        NC_EMAIL_VERIFICATION_MODE: "observe",
        EMAIL_PROVIDER: "test",
        EMAIL_FROM: "no-reply@nurseconnect.example",
        POSTMARK_SERVER_TOKEN: "token",
      }),
    ).toThrow("EMAIL_PROVIDER=postmark");
  });

  it("rejects non-HTTPS production callback URLs", () => {
    expect(() =>
      resolveEmailVerificationConfig({
        ...baseEnv,
        NODE_ENV: "production",
        APP_URL: "http://nurseconnect.example",
        NC_EMAIL_VERIFICATION_MODE: "enforce",
        EMAIL_PROVIDER: "postmark",
        EMAIL_FROM: "no-reply@nurseconnect.example",
        POSTMARK_SERVER_TOKEN: "token",
      }),
    ).toThrow("HTTPS APP_URL");
  });

  it("accepts a complete production enforce configuration", () => {
    const config = resolveEmailVerificationConfig({
      ...baseEnv,
      NODE_ENV: "production",
      APP_URL: "https://nurseconnect.example",
      NC_EMAIL_VERIFICATION_MODE: "enforce",
      EMAIL_PROVIDER: "postmark",
      EMAIL_FROM: "no-reply@nurseconnect.example",
      POSTMARK_SERVER_TOKEN: "token",
    });

    expect(config).toMatchObject({
      mode: "enforce",
      provider: "postmark",
      appUrl: "https://nurseconnect.example",
      emailFrom: "no-reply@nurseconnect.example",
    });
  });

  it("allows local enforce tests with the test provider", () => {
    const config = resolveEmailVerificationConfig({
      ...baseEnv,
      NC_EMAIL_VERIFICATION_MODE: "enforce",
      EMAIL_PROVIDER: "test",
    });

    expect(config).toMatchObject({
      mode: "enforce",
      provider: "test",
      appUrl: "http://localhost:3010",
    });
  });
});
