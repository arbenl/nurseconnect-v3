import { UnauthorizedError } from "./require-auth";
import { resolveCurrentSessionUser } from "./session-user";

type AppRole = "admin" | "nurse" | "patient";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAnyRole(allowedRoles: AppRole[]) {
  const resolved = await resolveCurrentSessionUser();
  if (!resolved) {
    throw new UnauthorizedError();
  }
  const { session, user } = resolved;

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError();
  }

  return { session, user };
}

export async function requireRole(role: AppRole) {
  return requireAnyRole([role]);
}
