import type { Role } from "@/types/role";

type KnownRole = Role | null | undefined;

const ROLE_TO_PATH: Record<Role, string> = {
  patient: "/dashboard",
  nurse: "/dashboard",
  admin: "/admin",
  referral_partner: "/partner",
};

export function getCanonicalRouteForRole(role: KnownRole | string): string | null {
  if (!role) return null;
  return ROLE_TO_PATH[role as Role] ?? null;
}

export function isCanonicalRouteForRole(
  role: KnownRole | string,
  pathname: string | null | undefined,
): boolean {
  const canonical = getCanonicalRouteForRole(role);
  if (!canonical || !pathname) return false;
  return pathname === canonical || pathname.startsWith(`${canonical}/`);
}

function isSafeRelativeCallback(callbackUrl: string): boolean {
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//");
}

export function normalizeCallbackUrlForRole(
  role: KnownRole | string,
  callbackUrl: string | null | undefined,
): string {
  const canonical = getCanonicalRouteForRole(role) ?? "/dashboard";
  if (!callbackUrl) return canonical;
  if (!isSafeRelativeCallback(callbackUrl)) return canonical;

  try {
    const parsed = new URL(callbackUrl, "https://nurseconnect.local");
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return isCanonicalRouteForRole(role, parsed.pathname) ? normalized : canonical;
  } catch {
    return canonical;
  }
}
