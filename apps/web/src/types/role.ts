export type Role = "patient" | "nurse" | "admin" | "referral_partner";

export const ROLES: Role[] = ["patient", "nurse", "admin", "referral_partner"];

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as string[]).includes(v);
}
