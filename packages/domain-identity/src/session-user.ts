import {
  ensureDomainUserFromSession,
  maybeBootstrapFirstAdmin,
  type DomainUser,
} from "./user-projection";

export type SessionUser = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

export type SessionLike = {
  user?: SessionUser | null;
} | null;

export type ResolvedSessionUser = {
  session: { user: { id: string; email: string; name?: string | null; image?: string | null } };
  user: DomainUser;
};

export async function resolveSessionUser(session: SessionLike): Promise<ResolvedSessionUser | null> {
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

  return {
    session: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    },
    user,
  };
}
