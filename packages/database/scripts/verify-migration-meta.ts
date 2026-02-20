import fs from "node:fs";
import path from "node:path";

// Execute from packages/database
const DRIZZLE_DIR = path.join(process.cwd(), "drizzle");
const META_DIR = path.join(DRIZZLE_DIR, "meta");
const JOURNAL_PATH = path.join(META_DIR, "_journal.json");

console.log(`Verifying Drizzle migration meta at ${JOURNAL_PATH}...`);

if (!fs.existsSync(JOURNAL_PATH)) {
    console.error(`❌ Journal file not found at ${JOURNAL_PATH}`);
    process.exit(1);
}

let journal;
try {
    const journalRaw = fs.readFileSync(JOURNAL_PATH, "utf-8");
    journal = JSON.parse(journalRaw);
} catch (err) {
    console.error(`❌ Failed to parse journal JSON:`, err);
    process.exit(1);
}

if (!journal?.entries || !Array.isArray(journal.entries)) {
    console.error("❌ Invalid journal format: missing 'entries' array.");
    process.exit(1);
}

let hasErrors = false;

for (const entry of journal.entries) {
    const tag = entry.tag; // e.g. "0006_long_ikaris"
    const idx = entry.idx; // e.g. 6

    // 1. Assert SQL file exists
    const sqlPath = path.join(DRIZZLE_DIR, `${tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ Missing SQL file for entry "${tag}": expected at ${sqlPath}`);
        hasErrors = true;
    }

    // 2. Assert snapshot exists
    const prefix = tag.slice(0, 4);
    const snapshotPath = path.join(META_DIR, `${prefix}_snapshot.json`);
    if (!fs.existsSync(snapshotPath)) {
        console.error(`❌ Missing snapshot file for entry "${tag}": expected at ${snapshotPath}`);
        hasErrors = true;
    }

    // 3. Assert idx matches numeric prefix
    const expectedIdx = Number(prefix);
    if (idx !== expectedIdx) {
        console.error(`❌ Index mismatch for "${tag}": journal says idx=${idx}, but tag prefix implies ${expectedIdx}.`);
        hasErrors = true;
    }
}

if (hasErrors) {
    console.error("\n❌ Migration meta verification failed due to the errors above.");
    process.exit(1);
}

console.log("✅ Migration meta verified successfully. All journal entries match disk files and snapshots.");
