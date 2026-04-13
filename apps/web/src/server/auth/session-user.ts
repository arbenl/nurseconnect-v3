import {
  ensureDomainUserFromSession,
  maybeBootstrapFirstAdmin,
} from "@/lib/user-service";

import { getSession } from "./get-session";

type SessionValue = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type DomainUser = NonNullable<Awaited<ReturnType<typeof ensureDomainUserFromSession>>>;

export type ResolvedSessionUser = {
  session: SessionValue;
  user: DomainUser;
};

export async function resolveCurrentSessionUser(): Promise<ResolvedSessionUser | null> {
  const session = await getSession();

  if (!session?.user?.id || !session.user.email) {
    return null;
  }

  const domainUser = await ensureDomainUserFromSession({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  if (!domainUser) {
    return null;
  }

  const user = (await maybeBootstrapFirstAdmin(domainUser)) ?? domainUser;
  return { session, user };
}
