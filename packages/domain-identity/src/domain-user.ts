import { and, db, eq, isNull, schema } from "@nurseconnect/database";

const { users } = schema;

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

export async function ensureDomainUserFromSession(data: SessionUserProjectionInput) {
  const email = data.email.trim().toLowerCase();

  const [existingByAuthId] = await db
    .select()
    .from(users)
    .where(eq(users.authId, data.id))
    .limit(1);

  if (existingByAuthId) {
    const [updated] = await db
      .update(users)
      .set({
        email,
        name: data.name ?? existingByAuthId.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByAuthId.id))
      .returning();

    return updated;
  }

  const [existingByEmail] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.authId)))
    .limit(1);

  if (existingByEmail) {
    const [updated] = await db
      .update(users)
      .set({
        authId: data.id,
        email,
        name: data.name ?? existingByEmail.name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingByEmail.id))
      .returning();

    return updated;
  }

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

export const upsertUser = ensureDomainUserFromSession;

export async function maybeBootstrapFirstAdmin(domainUser: DomainUser) {
  if (domainUser.role === "admin") {
    return domainUser;
  }

  const allowlist = parseAllowlist();
  const email = (domainUser.email ?? "").toLowerCase();

  if (allowlist.length > 0 && allowlist.includes(email)) {
    const [updated] = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.id, domainUser.id))
      .returning();

    return updated;
  }

  return domainUser;
}
