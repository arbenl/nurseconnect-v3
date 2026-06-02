import { and, db, eq, gte, ne, schema } from "@nurseconnect/database";

import {
  buildVerificationEmailPayload,
  type VerificationEmailInput,
  type VerificationEmailPayload,
} from "./email-provider-payload";
import {
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS,
  resolveEmailVerificationConfig,
  type EmailVerificationConfig,
} from "./email-verification-config";

export const AUTH_EMAIL_PROVIDER_SEND_FAILED = "AUTH_EMAIL_PROVIDER_SEND_FAILED";
export const AUTH_EMAIL_PROVIDER_CONFIG_INVALID = "AUTH_EMAIL_PROVIDER_CONFIG_INVALID";
export const AUTH_EMAIL_VERIFICATION_TOKEN_EXPIRED = "AUTH_EMAIL_VERIFICATION_TOKEN_EXPIRED";

const { authVerifications } = schema;

async function authUserEmailIsVerified(email: string) {
  const [authUser] = await db
    .select({ emailVerified: schema.authUsers.emailVerified })
    .from(schema.authUsers)
    .where(eq(schema.authUsers.email, email))
    .limit(1);

  return authUser?.emailVerified === true;
}

async function hasRecentVerificationEmail(identifier: string, currentToken?: string) {
  const since = new Date(Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000);
  const predicates = [
    eq(authVerifications.identifier, identifier),
    gte(authVerifications.createdAt, since),
  ];

  if (currentToken) {
    predicates.push(ne(authVerifications.value, currentToken));
  }

  const [recent] = await db
    .select({ id: authVerifications.id })
    .from(authVerifications)
    .where(and(...predicates))
    .limit(1);

  return Boolean(recent);
}

async function sendPostmarkEmail(
  payload: VerificationEmailPayload,
  config: EmailVerificationConfig,
) {
  if (!config.emailFrom || !config.postmarkServerToken) {
    throw new Error(AUTH_EMAIL_PROVIDER_CONFIG_INVALID);
  }

  const verificationUrl = new URL(payload.verificationUrl);
  if (verificationUrl.protocol !== "https:") {
    throw new Error(AUTH_EMAIL_PROVIDER_CONFIG_INVALID);
  }
  const safeVerificationUrl = verificationUrl.toString();

  const response = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Postmark-Server-Token": config.postmarkServerToken,
    },
    body: JSON.stringify({
      From: config.emailFrom,
      To: payload.to,
      Subject: "Verify your NurseConnect email",
      TextBody: `Verify your NurseConnect account: ${safeVerificationUrl}`,
      HtmlBody: `<p>Verify your NurseConnect account.</p><p><a href="${safeVerificationUrl}">Verify email</a></p>`,
      MessageStream: "outbound",
    }),
  });

  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: AUTH_EMAIL_PROVIDER_SEND_FAILED,
        provider: "postmark",
        status: response.status,
      }),
    );
    throw new Error(AUTH_EMAIL_PROVIDER_SEND_FAILED);
  }
}

export async function sendBetterAuthVerificationEmail(input: VerificationEmailInput) {
  const config = resolveEmailVerificationConfig();
  if (config.mode === "off") {
    return;
  }

  if (await authUserEmailIsVerified(input.user.email)) {
    return;
  }

  if (await hasRecentVerificationEmail(input.user.email, input.token)) {
    return;
  }

  const payload = buildVerificationEmailPayload(input);

  if (config.provider === "test") {
    // Test provider intentionally suppresses network sends; tests assert the typed payload boundary.
    return;
  }

  if (config.provider === "postmark") {
    await sendPostmarkEmail(payload, config);
    return;
  }

  throw new Error(AUTH_EMAIL_PROVIDER_CONFIG_INVALID);
}
