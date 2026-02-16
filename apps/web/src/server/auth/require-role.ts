import { db, schema, eq } from "@nurseconnect/database";
import { getSession } from "./get-session";
import { UnauthorizedError } from "./require-auth";

const { users } = schema;

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireRole(role: "admin" | "nurse" | "patient") {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  // Fetch domain user to check role
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    // Session exists but no domain user? Should have been bootstrapped.
    throw new UnauthorizedError("User profile not found");
  }

  if (user.role !== role) {
    // For now, strict equality. Later we might want hierarchy (admin > nurse).
    // Specifically for "admin", only admin is allowed.
    throw new ForbiddenError();
  }

  return { session, user };
}
