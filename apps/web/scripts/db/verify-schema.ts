
import { Pool } from "pg";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function verifySchema() {
    console.log("🔍 Verifying `nurses` table schema...");

    try {
        const client = await pool.connect();

        // Check for nurses table existence
        const tableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'nurses'
      );
    `);

        if (!tableRes.rows[0].exists) {
            console.error("❌ 'nurses' table does not exist!");
            process.exit(1);
        }

        // Check for specific columns
        const columnsToCheck = ["license_number", "specialization", "is_available"];
        const missingColumns = [];

        for (const col of columnsToCheck) {
            const colRes = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'nurses' 
          AND column_name = $1
        );
      `, [col]);

            if (!colRes.rows[0].exists) {
                missingColumns.push(col);
            }
        }

        client.release();

        if (missingColumns.length > 0) {
            console.error(`❌ Missing columns in 'nurses' table: ${missingColumns.join(", ")}`);
            process.exit(1);
        }

        console.log("✅ 'nurses' table has all required columns: license_number, specialization, is_available.");
        process.exit(0);

    } catch (err) {
        console.error("❌ Error verifying schema:", err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

verifySchema();
