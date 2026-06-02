import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_EMAIL_PROVIDER_CONFIG_INVALID,
  AUTH_EMAIL_PROVIDER_SEND_FAILED,
  sendBetterAuthVerificationEmail,
} from "./email-provider";
import { buildVerificationEmailPayload } from "./email-provider-payload";

const databaseMocks = vi.hoisted(() => {
  const limit = vi.fn();
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    db: { select },
    select,
    from,
    where,
    limit,
  };
});

vi.mock("@nurseconnect/database", () => ({
  and: vi.fn((...predicates) => ({ type: "and", predicates })),
  db: databaseMocks.db,
  eq: vi.fn((column, value) => ({ type: "eq", column, value })),
  gte: vi.fn((column, value) => ({ type: "gte", column, value })),
  ne: vi.fn((column, value) => ({ type: "ne", column, value })),
  schema: {
    authUsers: {
      email: "authUsers.email",
      emailVerified: "authUsers.emailVerified",
    },
    authVerifications: {
      createdAt: "authVerifications.createdAt",
      id: "authVerifications.id",
      identifier: "authVerifications.identifier",
      value: "authVerifications.value",
    },
  },
}));

const verificationInput = {
  user: {
    email: "patient@example.com",
  },
  url: "https://nurseconnect.example/api/auth/verify-email?token=token",
  token: "token",
};

function stubVerificationEnv(overrides: Record<string, string | undefined>) {
  vi.stubEnv("APP_URL", "https://nurseconnect.example");
  vi.stubEnv("NC_EMAIL_VERIFICATION_MODE", "enforce");
  vi.stubEnv("EMAIL_PROVIDER", "test");
  for (const [key, value] of Object.entries(overrides)) {
    vi.stubEnv(key, value);
  }
}

function mockDatabaseRows(...rows: unknown[][]) {
  databaseMocks.limit.mockReset();
  for (const row of rows) {
    databaseMocks.limit.mockResolvedValueOnce(row);
  }
}

describe("email provider boundary", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    databaseMocks.select.mockClear();
    databaseMocks.from.mockClear();
    databaseMocks.where.mockClear();
    databaseMocks.limit.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("builds a PHI-minimal verification email payload", () => {
    const payload = buildVerificationEmailPayload({
      user: {
        email: "patient@example.com",
      },
      url: "https://nurseconnect.example/api/auth/verify-email?token=token",
      token: "token",
    });

    expect(Object.keys(payload).sort()).toEqual(["templateId", "to", "verificationUrl"]);
    expect(payload).toEqual({
      to: "patient@example.com",
      verificationUrl: "https://nurseconnect.example/api/auth/verify-email?token=token",
      templateId: "email-verification",
    });
  });

  it("does nothing when verification mode is off", async () => {
    stubVerificationEnv({
      NC_EMAIL_VERIFICATION_MODE: "off",
      EMAIL_PROVIDER: "disabled",
    });

    await sendBetterAuthVerificationEmail(verificationInput);

    expect(databaseMocks.select).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips sends for already verified auth users", async () => {
    stubVerificationEnv({});
    mockDatabaseRows([{ emailVerified: true }]);

    await sendBetterAuthVerificationEmail(verificationInput);

    expect(databaseMocks.select).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("suppresses recent duplicate verification emails", async () => {
    stubVerificationEnv({});
    mockDatabaseRows([{ emailVerified: false }], [{ id: "verification_recent" }]);

    await sendBetterAuthVerificationEmail(verificationInput);

    expect(databaseMocks.select).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the test provider network-free after database checks", async () => {
    stubVerificationEnv({});
    mockDatabaseRows([{ emailVerified: false }], []);

    await sendBetterAuthVerificationEmail(verificationInput);

    expect(databaseMocks.select).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a Postmark email with only the verification payload", async () => {
    stubVerificationEnv({
      EMAIL_PROVIDER: "postmark",
      EMAIL_FROM: "no-reply@nurseconnect.example",
      POSTMARK_SERVER_TOKEN: "postmark-token",
    });
    mockDatabaseRows([{ emailVerified: false }], []);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true } as Response);

    await sendBetterAuthVerificationEmail(verificationInput);

    expect(fetch).toHaveBeenCalledWith(
      "https://api.postmarkapp.com/email",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Postmark-Server-Token": "postmark-token",
        }),
      }),
    );
    const [, request] = vi.mocked(fetch).mock.calls[0]!;
    const body = JSON.parse(String((request as RequestInit).body));
    expect(body).toMatchObject({
      From: "no-reply@nurseconnect.example",
      To: "patient@example.com",
      MessageStream: "outbound",
    });
    expect(body.TextBody).toContain(verificationInput.url);
    expect(JSON.stringify(body)).not.toContain("token: token");
  });

  it("rejects non-HTTPS verification URLs for Postmark sends", async () => {
    stubVerificationEnv({
      EMAIL_PROVIDER: "postmark",
      EMAIL_FROM: "no-reply@nurseconnect.example",
      POSTMARK_SERVER_TOKEN: "postmark-token",
    });
    mockDatabaseRows([{ emailVerified: false }], []);

    await expect(
      sendBetterAuthVerificationEmail({
        ...verificationInput,
        url: "http://nurseconnect.example/api/auth/verify-email?token=token",
      }),
    ).rejects.toThrow(AUTH_EMAIL_PROVIDER_CONFIG_INVALID);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("logs provider failures without logging the recipient or verification URL", async () => {
    stubVerificationEnv({
      EMAIL_PROVIDER: "postmark",
      EMAIL_FROM: "no-reply@nurseconnect.example",
      POSTMARK_SERVER_TOKEN: "postmark-token",
    });
    mockDatabaseRows([{ emailVerified: false }], []);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendBetterAuthVerificationEmail(verificationInput)).rejects.toThrow(
      AUTH_EMAIL_PROVIDER_SEND_FAILED,
    );

    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining(AUTH_EMAIL_PROVIDER_SEND_FAILED));
    const logged = errorLog.mock.calls.map((call) => call.join(" ")).join(" ");
    expect(logged).not.toContain("patient@example.com");
    expect(logged).not.toContain(verificationInput.url);
  });
});
