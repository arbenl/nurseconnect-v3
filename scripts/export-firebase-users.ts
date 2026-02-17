// scripts/export-firebase-users.ts
/**
 * One-time Firebase Auth export for PR-3.0 backfill.
 *
 * Usage:
 *   set -a; source tmp/firebase-export.env; set +a
 *   pnpm tsx scripts/export-firebase-users.ts
 *
 * Output:
 *   tmp/firebase-users.json  (gitignored)
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

type ExportedUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  phoneNumber: string | null;
  disabled: boolean;
  createdAt: string | null;
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) {
    throw new Error(`Missing required env var: ${name}. Did you source tmp/firebase-export.env?`);
  }
  return v;
}

function initFirebaseAdmin() {
  // Important: keep this script isolated; do not place these vars in .env.local
  const projectId = requiredEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requiredEnv("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = requiredEnv("FIREBASE_PRIVATE_KEY");

  // Allow both literal newlines and \n-escaped newlines
  const privateKey = privateKeyRaw.includes("\\n")
    ? privateKeyRaw.replace(/\\n/g, "\n")
    : privateKeyRaw;

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
  }
}

async function exportAllUsers(): Promise<ExportedUser[]> {
  const out: ExportedUser[] = [];

  let nextPageToken: string | undefined = undefined;
  do {
    const res = await admin.auth().listUsers(1000, nextPageToken);

    for (const u of res.users) {
      out.push({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        phoneNumber: u.phoneNumber ?? null,
        disabled: Boolean(u.disabled),
        createdAt: u.metadata?.creationTime ?? null,
      });
    }

    nextPageToken = res.pageToken;
  } while (nextPageToken);

  return out;
}

async function main() {
  initFirebaseAdmin();

  const users = await exportAllUsers();

  // Ensure tmp/ exists (gitignored)
  fs.mkdirSync("tmp", { recursive: true });

  const filePath = path.resolve("tmp/firebase-users.json");
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), "utf8");

  const withEmail = users.filter((u) => u.email).length;
  const withPhone = users.filter((u) => u.phoneNumber).length;
  const disabled = users.filter((u) => u.disabled).length;

  // eslint-disable-next-line no-console
  console.log(`✅ Exported ${users.length} Firebase Auth users`);
  // eslint-disable-next-line no-console
  console.log(`   With email: ${withEmail}`);
  // eslint-disable-next-line no-console
  console.log(`   With phone: ${withPhone}`);
  // eslint-disable-next-line no-console
  console.log(`   Disabled:   ${disabled}`);
  // eslint-disable-next-line no-console
  console.log(`📄 Wrote: ${filePath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Export failed:", err?.message ?? err);
  process.exit(1);
});
