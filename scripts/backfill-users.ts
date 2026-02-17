import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import "dotenv/config";

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { randomUUID } from "node:crypto";



const Args = z.object({
  input: z.string().min(1),
  apply: z.boolean().default(false),
  dryRun: z.boolean().default(true),
});

const FirebaseUser = z.object({
  uid: z.string().min(1),
  email: z.string().email().optional().nullable(),
  displayName: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  disabled: z.boolean().optional(),
  createdAt: z.string().optional().nullable(),
});

function parseArgs() {
  const raw = process.argv.slice(2);
  const inputIndex = raw.indexOf("--input");
  
  if (inputIndex === -1 || inputIndex + 1 >= raw.length) {
    throw new Error("--input <file> argument is required");
  }

  const input = raw[inputIndex + 1];
  const apply = raw.includes("--apply");
  const dryRun = raw.includes("--dry-run") || !apply;
  
  return Args.parse({ input, apply, dryRun });
}

function normEmail(email?: string | null) {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  return e.length ? e : null;
}

async function main() {
  const { db, schema, eq } = await import("../packages/database/src/index");
  const { users } = schema;

  const args = parseArgs();
  console.log(`Running backfill with mode: ${args.dryRun ? "DRY RUN" : "APPLY"}`);
  
  const filePath = path.resolve(args.input);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }
  
  const content = fs.readFileSync(filePath, "utf8");
  // Default firebase export is often logical-lines of JSON or a wrapper. 
  // Assuming generic array format as requested: [{...}, {...}]
  let inputJson;
  try {
    inputJson = JSON.parse(content);
    // If wrapped in "users": [...]
    if (!Array.isArray(inputJson) && inputJson.users) {
      inputJson = inputJson.users;
    }
  } catch (e) {
    throw new Error("Failed to parse input JSON");
  }

  const inputArr = z.array(FirebaseUser).parse(inputJson);

  const report = {
    mode: args.dryRun ? "dry-run" : "apply",
    total: inputArr.length,
    inserted: 0,
    updated: 0,
    linked: 0,
    skipped: 0,
    conflicts: [] as Array<{ uid: string; email?: string | null; reason: string }>,
    errors: [] as Array<{ uid?: string; reason: string }>,
  };

  for (const u of inputArr) {
    try {
      const email = normEmail(u.email);
      const name = u.displayName?.trim() || null;

      // Require at least uid + (email or phone) to be useful
      if (!u.uid || (!email && !u.phoneNumber)) {
        report.skipped++;
        continue;
      }

      // 1) Match by firebase_uid
      const byFirebase = await db.query.users.findFirst({
        where: eq(users.firebaseUid, u.uid),
      });

      if (byFirebase) {
        // Already exists by UID - update missing fields if any
        const patch: any = {};
        if (!byFirebase.email && email) patch.email = email;
        if (!byFirebase.name && name) patch.name = name;

        if (Object.keys(patch).length > 0) {
          if (!args.dryRun) {
            await db.update(users).set({
              ...patch,
              updatedAt: new Date(),
            }).where(eq(users.id, byFirebase.id));
          }
          report.updated++;
        } else {
             // Up to date
        }
        continue;
      }

      // 2) Match by Domain Email (Link)
      if (email) {
        const byEmail = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        if (byEmail) {
          if (byEmail.firebaseUid && byEmail.firebaseUid !== u.uid) {
            report.conflicts.push({
              uid: u.uid,
              email,
              reason: `email already linked to different firebase_uid=${byEmail.firebaseUid}`,
            });
            continue;
          }
          
          // Link it
          if (!args.dryRun) {
            await db
              .update(users)
              .set({ 
                firebaseUid: u.uid,
                updatedAt: new Date(),
              })
              .where(eq(users.id, byEmail.id));
          }
          report.linked++;
          continue;
        }
      }

      // 3) Insert new domain user
      const id = randomUUID();

        
        // Wait, schema requires email.
        if (!email) {
            report.skipped++;
            report.errors.push({ uid: u.uid, reason: "Missing email for new insert (schema constraint)" });
            continue;
        }

      if (!args.dryRun) {
        await db.insert(users).values({
          id,
          email,
          name,
          role: "patient", // Default role
          firebaseUid: u.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      report.inserted++;
    } catch (e) {
      report.errors.push({
        uid: (u as any)?.uid,
        reason: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  const outDir = path.resolve("tmp");
  if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
  }
  const outPath = path.join(outDir, `backfill-users-report.${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report written: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
