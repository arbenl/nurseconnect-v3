// apps/web/src/lib/firebase/admin.ts
import { type App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Detect emulator from env (either explicit flag, or emulator hosts present)
const isEmulator =
  process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' ||
  !!process.env.FIRESTORE_EMULATOR_HOST ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

let app: App;

if (!getApps().length) {
  if (isEmulator) {
    // Emulator: no credentials needed; projectId is enough
    app = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-nurseconnect',
    });
  } else {
    // Production: use service account (base64-encoded JSON in env)
    const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64;
    if (!base64) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 is not set for production environment.');
    }
    const serviceAccount = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
    app = initializeApp({ credential: cert(serviceAccount) });
  }
} else {
  app = getApp();
}

export const adminApp = app;
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);