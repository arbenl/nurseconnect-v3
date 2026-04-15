import { redirect } from "next/navigation";

import { getCanonicalRouteForRole } from "@/lib/canonical-routes";
import { getNurseByUserId } from "@/lib/nurse-record";

import {
  resolveCurrentSessionUser,
  type ResolvedSessionUser,
} from "./session-user";

type Portal = "app" | "admin";
type SessionValue = ResolvedSessionUser["session"];
type DomainUser = ResolvedSessionUser["user"];

type PortalAccessResolution =
  | {
      redirectTo: string;
      canonicalRoute: null;
      profileComplete: false;
      session: null;
      user: null;
    }
  | {
      redirectTo: null;
      canonicalRoute: string;
      profileComplete: boolean;
      session: SessionValue;
      user: DomainUser;
    };

type GrantedPortalAccess = Extract<PortalAccessResolution, { redirectTo: null }>;

function redirectResolution(redirectTo: string): PortalAccessResolution {
  return {
    redirectTo,
    canonicalRoute: null,
    profileComplete: false,
    session: null,
    user: null,
  };
}

async function isProfileComplete(user: DomainUser): Promise<boolean> {
  const hasPatientFields = Boolean(
    user.firstName &&
      user.lastName &&
      user.phone &&
      user.city,
  );

  if (!hasPatientFields) return false;
  if (user.role !== "nurse") return true;

  const nurse = await getNurseByUserId(user.id);
  return Boolean(nurse?.licenseNumber && nurse?.specialization);
}

export async function resolvePortalAccess(options: {
  currentPath: string;
  portal: Portal;
  requireProfileComplete?: boolean;
}): Promise<PortalAccessResolution> {
  const loginPath = `/login?callbackUrl=${encodeURIComponent(options.currentPath)}`;
  const resolved = await resolveCurrentSessionUser();
  if (!resolved) {
    return redirectResolution(loginPath);
  }
  const { session, user } = resolved;

  const canonicalRoute = getCanonicalRouteForRole(user.role) ?? "/dashboard";
  if (options.portal === "admin" && canonicalRoute !== "/admin") {
    return redirectResolution(canonicalRoute);
  }

  if (options.portal === "app" && canonicalRoute === "/admin") {
    return redirectResolution(canonicalRoute);
  }

  const profileComplete = await isProfileComplete(user);
  if (options.requireProfileComplete && !profileComplete) {
    return redirectResolution("/onboarding");
  }

  return {
    redirectTo: null,
    canonicalRoute,
    profileComplete,
    session,
    user,
  };
}

export async function requirePortalAccessOrRedirect(options: {
  currentPath: string;
  portal: Portal;
  requireProfileComplete?: boolean;
}): Promise<GrantedPortalAccess> {
  const resolution = await resolvePortalAccess(options);
  if (resolution.redirectTo !== null) {
    redirect(resolution.redirectTo);
  }
  return resolution;
}
