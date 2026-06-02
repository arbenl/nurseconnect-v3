import { z } from "zod";

export const EMAIL_VERIFICATION_TOKEN_TTL_SECONDS = 3600;
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 300;

export type EmailVerificationMode = "off" | "observe" | "enforce";
export type EmailProvider = "disabled" | "test" | "postmark";

export type EmailVerificationConfig = {
  mode: EmailVerificationMode;
  provider: EmailProvider;
  appUrl: string;
  trustedOrigins: string[];
  emailFrom?: string;
  postmarkServerToken?: string;
};

type ConfigInput = Record<string, string | undefined>;

function emptyToUndefined(input: ConfigInput): ConfigInput {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      value?.trim() ? value : undefined,
    ]),
  );
}

const rawConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PHASE: z.string().optional(),
  NC_EMAIL_VERIFICATION_MODE: z.enum(["off", "observe", "enforce"]).default("off"),
  EMAIL_PROVIDER: z.enum(["disabled", "test", "postmark"]).default("disabled"),
  EMAIL_FROM: z.string().email().optional(),
  POSTMARK_SERVER_TOKEN: z.string().min(1).optional(),
  APP_URL: z.string().url().optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  VERCEL_URL: z.string().min(1).optional(),
});

function deploymentUrl(input: ConfigInput) {
  return input.VERCEL_URL ? `https://${input.VERCEL_URL}` : undefined;
}

function resolvePublicAppUrl(input: ConfigInput) {
  return (
    input.APP_URL ||
    input.BETTER_AUTH_URL ||
    deploymentUrl(input) ||
    "http://localhost:3010"
  );
}

function uniqueOrigins(origins: Array<string | undefined>) {
  return Array.from(new Set(origins.filter((origin): origin is string => Boolean(origin))));
}

export function resolveEmailVerificationConfig(
  input: ConfigInput = process.env,
): EmailVerificationConfig {
  const normalizedInput = emptyToUndefined(input);
  const raw = {
    ...normalizedInput,
    APP_URL: resolvePublicAppUrl(normalizedInput),
  };
  const parsed = rawConfigSchema.parse(raw);
  const appUrl = parsed.APP_URL ?? "http://localhost:3010";
  const appUrlProtocol = new URL(appUrl).protocol;
  const isProduction = parsed.NODE_ENV === "production";
  const isProductionBuild = isProduction && parsed.NEXT_PHASE === "phase-production-build";
  const verificationEnabled = parsed.NC_EMAIL_VERIFICATION_MODE !== "off";

  if (isProduction && !isProductionBuild && parsed.NC_EMAIL_VERIFICATION_MODE === "off") {
    throw new Error("[env] NC_EMAIL_VERIFICATION_MODE=off is not allowed in production.");
  }

  if (isProduction && !isProductionBuild && !verificationEnabled) {
    throw new Error("[env] Production email verification must run in observe or enforce mode.");
  }

  if (isProduction && !isProductionBuild && !normalizedInput.APP_URL && !normalizedInput.BETTER_AUTH_URL) {
    throw new Error("[env] Production email verification requires APP_URL or BETTER_AUTH_URL.");
  }

  if (isProduction && !isProductionBuild && verificationEnabled && appUrlProtocol !== "https:") {
    throw new Error("[env] Production email verification requires a HTTPS APP_URL or BETTER_AUTH_URL.");
  }

  if (isProduction && !isProductionBuild && parsed.EMAIL_PROVIDER !== "postmark") {
    throw new Error("[env] Production email verification requires EMAIL_PROVIDER=postmark.");
  }

  if (verificationEnabled && parsed.EMAIL_PROVIDER === "disabled") {
    throw new Error("[env] Email verification requires EMAIL_PROVIDER=test or postmark.");
  }

  if (verificationEnabled && parsed.EMAIL_PROVIDER === "postmark" && !parsed.EMAIL_FROM) {
    throw new Error("[env] Email verification with Postmark requires EMAIL_FROM.");
  }

  if (verificationEnabled && parsed.EMAIL_PROVIDER === "postmark" && !parsed.POSTMARK_SERVER_TOKEN) {
    throw new Error("[env] Email verification with Postmark requires POSTMARK_SERVER_TOKEN.");
  }

  return {
    mode: parsed.NC_EMAIL_VERIFICATION_MODE,
    provider: parsed.EMAIL_PROVIDER,
    appUrl,
    trustedOrigins: uniqueOrigins([appUrl, normalizedInput.BETTER_AUTH_URL, deploymentUrl(normalizedInput)]),
    emailFrom: parsed.EMAIL_FROM,
    postmarkServerToken: parsed.POSTMARK_SERVER_TOKEN,
  };
}
