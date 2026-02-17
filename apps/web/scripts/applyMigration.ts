import { db } from "@nurseconnect/database";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Applying migration 0002 manually...");

    try {
        await db.execute(sql`ALTER TABLE "nurses" ADD COLUMN IF NOT EXISTS "license_number" text;`);
        console.log("Applied license_number");
    } catch (e) { console.error("Error applying license_number", e); }

    try {
        await db.execute(sql`ALTER TABLE "nurses" ADD COLUMN IF NOT EXISTS "specialization" text;`);
        console.log("Applied specialization");
    } catch (e) { console.error("Error applying specialization", e); }

    try {
        await db.execute(sql`ALTER TABLE "nurses" ADD COLUMN IF NOT EXISTS "is_available" boolean DEFAULT false NOT NULL;`);
        console.log("Applied is_available");
    } catch (e) { console.error("Error applying is_available", e); }

    console.log("Done.");
    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
