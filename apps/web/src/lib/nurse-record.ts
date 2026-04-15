import { db, eq, schema } from "@nurseconnect/database";

const { nurses } = schema;

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
      status: "draft",
    })
    .returning();

  return nurse;
}
