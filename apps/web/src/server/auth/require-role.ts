import {
  requireAnyRole as requireAnyRolePolicy,
  requireRole as requireRolePolicy,
  type ResolvedSessionUser,
} from "@nurseconnect/domain-identity";

import { resolveCurrentSessionUser } from "./session-user";

type AppRole = ResolvedSessionUser["user"]["role"];

export { ForbiddenError, UnauthorizedError } from "@nurseconnect/domain-identity";

export async function requireAnyRole(allowedRoles: AppRole[]) {
  return requireAnyRolePolicy(allowedRoles, await resolveCurrentSessionUser());
}

export async function requireRole(role: AppRole) {
  return requireRolePolicy(role, await resolveCurrentSessionUser());
}
