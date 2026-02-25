import { db, schema, eq } from "@nurseconnect/database";

import { getSession } from "./get-session";
import { UnauthorizedError } from "./require-auth";

const { users } = schema;
type AppRole = "admin" | "nurse" | "patient";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireAnyRole(allowedRoles: AppRole[]) {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  // Fetch domain user to check role
  const user = await db.query.users.findFirst({
    where: eq(users.authId, session.user.id),
  });

  if (!user) {
    // Session exists but no domain user? Should have been bootstrapped.
    throw new UnauthorizedError("User profile not found");
  }

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError();
  }

  return { session, user };
}

export async function requireRole(role: AppRole) {
  return requireAnyRole([role]);
}
