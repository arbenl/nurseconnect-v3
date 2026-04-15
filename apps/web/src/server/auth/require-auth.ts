import { UnauthorizedError } from "@nurseconnect/domain-identity";

import { getSession } from "./get-session";

export { UnauthorizedError } from "@nurseconnect/domain-identity";

export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw new UnauthorizedError();
  }

  return session;
}
