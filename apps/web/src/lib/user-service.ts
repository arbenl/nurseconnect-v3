import { db, schema } from "@nurseconnect/database";

const { users } = schema;

/**
 * Upserts a user into the domain database based on their Auth ID.
 * This ensures that every Better-Auth user has a corresponding record in the domain users table.
 */
export async function upsertUserFromSession(data: {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const [user] = await db
    .insert(users)
    .values({
      id: data.id, // Canonical ID from Better-Auth
      email: data.email,
      name: data.name,
      role: "patient", // Default role
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: data.email,
        name: data.name,
        updatedAt: new Date(),
      },
    })
    .returning();

  return user;
}

export const upsertUser = upsertUserFromSession;
