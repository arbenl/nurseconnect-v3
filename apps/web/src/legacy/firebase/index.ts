/**
 * Legacy Firebase barrel export.
 *
 * ⚠️  QUARANTINED — Phase 3 removal target.
 *
 * Only auth/config.ts, api/user/route.ts, api/auth/signup/route.ts,
 * api/profile/route.ts, and emulator tests should import from here.
 * New code MUST use @nurseconnect/database instead.
 */
export { adminApp, adminAuth, adminDb } from "./admin";
export { db as adminDbFirestore } from "./db-admin";
export { app, auth, db } from "./firebaseClient";
