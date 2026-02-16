// vitest.setup.ts
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Minimal config for tests
const app = initializeApp({
  apiKey: "fake-api-key",
  authDomain: "localhost",
  projectId: "nurseconnect-v2", // must match your emulator project ID (demo-nurseconnect)
});

// Auth
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9098");

// Firestore
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8081);

export { auth, db };
