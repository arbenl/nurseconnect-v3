import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn((options: unknown) => ({ options })),
  db: {},
  drizzleAdapter: vi.fn(() => "drizzle-adapter"),
  resolveEmailVerificationConfig: vi.fn(),
  sendBetterAuthVerificationEmail: vi.fn(),
  schema: {
    authUsers: "authUsers",
    authSessions: "authSessions",
    authAccounts: "authAccounts",
    authVerifications: "authVerifications",
  },
}));

vi.mock("@nurseconnect/database", () => ({
  db: mocks.db,
  schema: mocks.schema,
}));

vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: mocks.drizzleAdapter,
}));

vi.mock("better-auth/minimal", () => ({
  betterAuth: mocks.betterAuth,
}));

vi.mock("./auth/email-provider", () => ({
  sendBetterAuthVerificationEmail: mocks.sendBetterAuthVerificationEmail,
}));

vi.mock("./auth/email-verification-config", () => ({
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS: 3600,
  resolveEmailVerificationConfig: mocks.resolveEmailVerificationConfig,
}));

describe("auth", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.betterAuth.mockClear();
    mocks.drizzleAdapter.mockClear();
    mocks.resolveEmailVerificationConfig.mockReturnValue({
      appUrl: "https://app.nurseconnect.example",
      mode: "observe",
      trustedOrigins: ["https://app.nurseconnect.example"],
    });
  });

  it("wires Better Auth with email verification settings", async () => {
    const { auth } = await import("./auth");

    expect(auth).toEqual({ options: expect.any(Object) });
    expect(mocks.drizzleAdapter).toHaveBeenCalledWith(mocks.db, {
      provider: "pg",
      schema: {
        user: mocks.schema.authUsers,
        session: mocks.schema.authSessions,
        account: mocks.schema.authAccounts,
        verification: mocks.schema.authVerifications,
      },
    });
    expect(mocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://app.nurseconnect.example",
        basePath: "/api/auth",
        trustedOrigins: ["https://app.nurseconnect.example"],
        database: "drizzle-adapter",
        emailAndPassword: expect.objectContaining({
          enabled: true,
          autoSignIn: true,
          requireEmailVerification: false,
        }),
        emailVerification: expect.objectContaining({
          sendVerificationEmail: mocks.sendBetterAuthVerificationEmail,
          sendOnSignUp: true,
          sendOnSignIn: true,
          expiresIn: 3600,
        }),
      }),
    );
  });

  it("enforces email verification in enforce mode", async () => {
    mocks.resolveEmailVerificationConfig.mockReturnValue({
      appUrl: "https://app.nurseconnect.example",
      mode: "enforce",
      trustedOrigins: ["https://app.nurseconnect.example"],
    });

    await import("./auth");

    expect(mocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        emailAndPassword: expect.objectContaining({
          autoSignIn: false,
          requireEmailVerification: true,
        }),
      }),
    );
  });
});
