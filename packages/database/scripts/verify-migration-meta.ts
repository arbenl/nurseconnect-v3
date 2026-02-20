import fs from "node:fs";
import path from "node:path";

/**
 * Migration Meta Verifier
 * 
 * Note on "idx gaps":
 * Gaps in migration idx numbers are safe because Drizzle tracks applied migrations by tag name 
 * (and folderMillis), not by sequential idx array position. The idx field is just a numeric 
 * prefix counter that gets incremented when generating tags, but doesn't need to be perfectly 
 * sequential if local migrations are squashed or removed prior to merge.
 * 
 * This script validates that each entry's idx mathematically matches its tag prefix 
 * (e.g., idx=6 for tag "0006_long_ikaris"), not that idx values are strictly sequential.
 */

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
    const tag = entry?.tag; // e.g. "0006_long_ikaris"
    const idx = entry?.idx; // e.g. 6

    // Validate tag
    if (typeof tag !== "string" || tag.trim().length === 0) {
        console.error(`❌ Invalid journal entry: missing or empty 'tag' property. Entry: ${JSON.stringify(entry)}`);
        hasErrors = true;
        continue;
    }

    // Validate idx
    if (typeof idx !== "number" || !Number.isFinite(idx)) {
        console.error(`❌ Invalid idx for entry "${tag}": expected a finite number but got ${String(idx)}.`);
        hasErrors = true;
        continue;
    }

    const normalizedTag = tag.trim();

    // 1. Assert SQL file exists
    const sqlPath = path.join(DRIZZLE_DIR, `${normalizedTag}.sql`);
    if (!fs.existsSync(sqlPath)) {
        console.error(`❌ Missing SQL file for entry "${normalizedTag}": expected at ${sqlPath}`);
        hasErrors = true;
    }

    // Extract prefix properly
    const prefixMatch = /^(\d{4})/.exec(normalizedTag);
    if (!prefixMatch) {
        console.error(`❌ Invalid tag format for "${normalizedTag}": expected to start with 4 digits.`);
        hasErrors = true;
        continue;
    }
    const prefix = prefixMatch[1];
    const expectedIdx = Number(prefix);

    // 2. Assert snapshot exists
    const snapshotPath = path.join(META_DIR, `${prefix}_snapshot.json`);
    if (!fs.existsSync(snapshotPath)) {
        console.error(`❌ Missing snapshot file for entry "${normalizedTag}": expected at ${snapshotPath}`);
        hasErrors = true;
    }

    // 3. Assert idx matches numeric prefix
    if (idx !== expectedIdx) {
        console.error(`❌ Index mismatch for "${normalizedTag}": journal says idx=${idx}, but tag prefix implies ${expectedIdx}.`);
        hasErrors = true;
    }
}

if (hasErrors) {
    console.error("\n❌ Migration meta verification failed due to the errors above.");
    process.exit(1);
}

console.log("✅ Migration meta verified successfully. All journal entries match disk files and snapshots.");
