import { ForbiddenError, UnauthorizedError } from "./errors";
import type { ResolvedSessionUser } from "./session-user";

type AppRole = ResolvedSessionUser["user"]["role"];

export async function requireAnyRole(
  allowedRoles: AppRole[],
  resolved: ResolvedSessionUser | null,
) {
  if (!resolved) {
    throw new UnauthorizedError();
  }

  if (!allowedRoles.includes(resolved.user.role)) {
    throw new ForbiddenError();
  }

  return resolved;
}

export async function requireRole(role: AppRole, resolved: ResolvedSessionUser | null) {
  return requireAnyRole([role], resolved);
}
