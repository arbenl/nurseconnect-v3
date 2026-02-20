import { db, schema, eq } from "@nurseconnect/database";

const { users, nurses } = schema;

const parseAllowlist = () =>
  (process.env.FIRST_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/**
 * Upserts a user into the domain database based on their Auth ID.
 * This ensures that every Better-Auth user has a corresponding record in the domain users table.
 */
export async function ensureDomainUserFromSession(data: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const [user] = await db
    .insert(users)
    .values({
      authId: data.id, // Map Better-Auth ID to authId
      email: data.email,
      name: data.name,
      role: "patient", // Default role
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
  return user;
}

export const upsertUser = ensureDomainUserFromSession;

export async function getNurseByUserId(userId: string) {
  const [nurse] = await db
    .select()
    .from(nurses)
    .where(eq(nurses.userId, userId));
  return nurse;
}

export async function createNurseRecord(userId: string) {
  const [nurse] = await db
    .insert(nurses)
    .values({
      userId,
      status: "pending", // Default status
    })
    .returning();
  return nurse;
}



/**
 * Promotes the user to admin if they are the first user OR in the allowlist.
 */
export async function maybeBootstrapFirstAdmin(domainUser: typeof users.$inferSelect) {
  if (domainUser.role === "admin") return domainUser;

  const allowlist = parseAllowlist();
  const email = (domainUser.email ?? "").toLowerCase();

  // Explicit bootstrap: only promote if email is in the allowlist.
  // If allowlist is empty or email strongly mismatches, fallback is safety.
  if (allowlist.length > 0 && allowlist.includes(email)) {
    const [updated] = await db
      .update(users)
      .set({ role: "admin" })
      .where(eq(users.id, domainUser.id))
      .returning();
    return updated;
  }

  // Not in allowlist (or allowlist is empty) -> unchanged
  return domainUser;
}
