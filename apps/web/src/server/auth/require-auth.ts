import { db, eq, schema } from "@nurseconnect/database";
import { UnauthorizedError } from "@nurseconnect/domain-identity";

import { resolveEmailVerificationConfig } from "@/lib/auth/email-verification-config";

import { getSession } from "./get-session";

export { UnauthorizedError } from "@nurseconnect/domain-identity";

const { authUsers } = schema;

type SessionWithUser = NonNullable<Awaited<ReturnType<typeof getSession>>>;

async function authUserIsVerified(authUserId: string) {
  const [authUser] = await db
    .select({ emailVerified: authUsers.emailVerified })
    .from(authUsers)
    .where(eq(authUsers.id, authUserId))
    .limit(1);

  return authUser?.emailVerified === true;
}

function logUnverifiedAccess(authUserId: string, route: string) {
  console.warn(
    JSON.stringify({
      event: "auth.unverified_access",
      authUserId,
      route,
      mode: "observe",
    }),
  );
}

export async function assertEmailVerificationAccess(
  session: SessionWithUser,
  route = "unknown",
) {
  const config = resolveEmailVerificationConfig();
  if (config.mode === "off") {
    return;
  }

  const authUserId = session.user?.id;
  if (!authUserId) {
    throw new UnauthorizedError();
  }

  if (await authUserIsVerified(authUserId)) {
    return;
  }

  if (config.mode === "observe") {
    logUnverifiedAccess(authUserId, route);
    return;
  }

  throw new UnauthorizedError("Email verification required");
}

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  await assertEmailVerificationAccess(session, "requireAuth");

  return session;
}
