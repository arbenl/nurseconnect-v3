import { db, schema, eq } from "@nurseconnect/database";

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Usage: tsx scripts/checkUser.ts <email>");
        process.exit(1);
    }

    console.log(`Checking user ${email}...`);
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));

    if (!user) {
        console.log("User NOT found in DB");
    } else {
        console.log("User found:", user);
        console.log("Role:", user.role);
    }

    // Also check nurses table
    if (user) {
        const [nurse] = await db.select().from(schema.nurses).where(eq(schema.nurses.userId, user.id));
        console.log("Nurse record:", nurse);
    }

    process.exit(0);
}

main().catch(console.error);
