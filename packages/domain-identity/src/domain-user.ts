import { db, eq, schema } from "@nurseconnect/database";

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
  const [user] = await db
    .insert(users)
    .values({
      authId: data.id,
      email: data.email,
      name: data.name,
      role: "patient",
    })
    .onConflictDoUpdate({
      target: users.authId,
      set: {
        email: data.email,
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
