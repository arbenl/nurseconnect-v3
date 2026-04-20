import {
  isUserPortalProfileComplete,
  resolvePortalAccessPolicy,
  type ResolvedSessionUser,
} from "@nurseconnect/domain-identity";
import { redirect } from "next/navigation";

import { getCanonicalRouteForRole } from "@/lib/canonical-routes";
import { getNurseByUserId } from "@/lib/nurse-record";

import {
  resolveCurrentSessionUser,
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

export async function resolvePortalAccess(options: {
  currentPath: string;
  portal: Portal;
  requireProfileComplete?: boolean;
}): Promise<PortalAccessResolution> {
  const resolved = await resolveCurrentSessionUser();
  const nurse =
    resolved?.user.role === "nurse" ? (await getNurseByUserId(resolved.user.id)) ?? null : null;
  const profileComplete = resolved ? isUserPortalProfileComplete(resolved.user, nurse) : false;
  const canonicalRoute = resolved ? getCanonicalRouteForRole(resolved.user.role) ?? "/dashboard" : null;

  return resolvePortalAccessPolicy({
    currentPath: options.currentPath,
    portal: options.portal,
    resolved,
    canonicalRoute,
    profileComplete,
    requireProfileComplete: options.requireProfileComplete,
  });
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
