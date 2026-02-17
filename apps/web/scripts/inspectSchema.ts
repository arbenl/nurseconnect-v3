import { db } from "@nurseconnect/database";
import { sql } from "drizzle-orm";

async function main() {
    const result = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'nurses';
  `);
    console.log("Columns in nurses table:");
    console.table(result.rows);
    process.exit(0);
}

main().catch(console.error);
