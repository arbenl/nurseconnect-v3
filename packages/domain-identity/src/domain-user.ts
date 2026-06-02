import { and, db, eq, isNull, schema } from "@nurseconnect/database";

const { authUsers, users } = schema;

export type DomainUser = typeof users.$inferSelect;

type SessionUserProjectionInput = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

const parseAllowlist = () =>
  (process.env.FIRST_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

async function authEmailIsVerified(authId: string) {
  const [authUser] = await db
    .select({ emailVerified: authUsers.emailVerified })
    .from(authUsers)
    .where(eq(authUsers.id, authId))
    .limit(1);

  return authUser?.emailVerified === true;
}

export async function ensureDomainUserFromSession(data: SessionUserProjectionInput) {
  const email = data.email.trim().toLowerCase();

  const [existingByAuthId] = await db
    .select()
    .from(users)
    .where(eq(users.authId, data.id))
    .limit(1);

  if (existingByAuthId) {
    const nextName = data.name ?? existingByAuthId.name;
    if (existingByAuthId.email === email && existingByAuthId.name === nextName) {
      return existingByAuthId;
    }

    const [updated] = await db
      .update(users)
      .set({
        email,
        name: nextName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByAuthId.id))
      .returning();

    return updated;
  }

  const shellCandidates = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), isNull(users.authId)))
    .limit(2);

  if (shellCandidates.length > 1) {
    throw new Error("Ambiguous unauthenticated shell rows for email");
  }

  const canClaimShell = shellCandidates.length === 1 && (await authEmailIsVerified(data.id));

  if (canClaimShell) {
    const [shellCandidate] = shellCandidates;
    if (!shellCandidate) {
      throw new Error("Expected one unauthenticated shell row");
    }

    // Shell claims intentionally preserve firstName/lastName until the shell lifecycle slice owns them.
    const claimPatch =
      data.name == null
        ? { authId: data.id, email, updatedAt: new Date() }
        : { authId: data.id, email, name: data.name, updatedAt: new Date() };
    const [claimedByEmail] = await db
      .update(users)
      .set(claimPatch)
      .where(and(eq(users.id, shellCandidate.id), isNull(users.authId)))
      .returning();

    if (claimedByEmail) {
      return claimedByEmail;
    }
  }

  const [claimedByConcurrentRequest] = await db
    .select()
    .from(users)
    .where(eq(users.authId, data.id))
    .limit(1);

  if (claimedByConcurrentRequest) {
    return claimedByConcurrentRequest;
  }

  // users_auth_id_idx plus ON CONFLICT is the DB-level guard for concurrent first logins.
  const [user] = await db
    .insert(users)
    .values({
      authId: data.id,
      email,
      name: data.name,
      role: "patient",
    })
    .onConflictDoUpdate({
      target: users.authId,
      set: {
        email,
        name: data.name,
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}

/** @deprecated Use ensureDomainUserFromSession for session-backed domain projections. */
export const upsertUser = ensureDomainUserFromSession;

export async function maybeBootstrapFirstAdmin(domainUser: DomainUser) {
  if (domainUser.role === "admin") {
    return domainUser;
  }

  const allowlist = parseAllowlist();
  const email = (domainUser.email ?? "").toLowerCase();

  if (allowlist.length > 0 && allowlist.includes(email) && domainUser.authId) {
    const verified = await authEmailIsVerified(domainUser.authId);
    if (!verified) {
      return domainUser;
    }

    const [updated] = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.id, domainUser.id))
      .returning();

    return updated;
  }

  return domainUser;
}
