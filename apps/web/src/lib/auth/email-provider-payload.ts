export type VerificationEmailPayload = {
  to: string;
  verificationUrl: string;
  templateId: "email-verification";
};

export type VerificationEmailInput = {
  user: {
    email: string;
  };
  url: string;
  token?: string;
};

export function buildVerificationEmailPayload(input: VerificationEmailInput): VerificationEmailPayload {
  return {
    to: input.user.email,
    verificationUrl: input.url,
    templateId: "email-verification",
  };
}
