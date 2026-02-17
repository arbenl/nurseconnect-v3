import { db, eq, schema } from "@nurseconnect/database";

import { getSession } from "@/server/auth/get-session";

const { users } = schema;

export async function getCachedUser() {
    const session = await getSession();
    if (!session?.user?.email) return null;

    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.authId, session.user.id));

    return user ?? null;
}
