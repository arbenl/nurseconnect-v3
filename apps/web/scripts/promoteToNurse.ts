import { db, schema, eq } from "@nurseconnect/database";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: tsx scripts/promoteToNurse.ts <email>");
        process.exit(1);
    }

    console.log(`Looking up user ${email}...`);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));

    if (!user) {
        console.error("User not found");
        process.exit(1);
    }

    console.log(`Promoting ${user.id} to nurse...`);
    await db.update(schema.users).set({ role: "nurse" }).where(eq(schema.users.id, user.id));

    console.log("Done.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
