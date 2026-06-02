import {
  resolveSessionUser,
  type ResolvedSessionUser,
  UnauthorizedError,
} from "@nurseconnect/domain-identity";

import { getSession } from "./get-session";
import { assertEmailVerificationAccess } from "./require-auth";

export type { ResolvedSessionUser } from "@nurseconnect/domain-identity";

export async function resolveCurrentSessionUser(): Promise<ResolvedSessionUser | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  try {
    await assertEmailVerificationAccess(session, "resolveCurrentSessionUser");
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }

  return resolveSessionUser(session);
}
