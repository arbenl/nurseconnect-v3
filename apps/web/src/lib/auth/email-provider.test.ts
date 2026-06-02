import { describe, expect, it } from "vitest";

import { buildVerificationEmailPayload } from "./email-provider-payload";

describe("email provider boundary", () => {
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
});
