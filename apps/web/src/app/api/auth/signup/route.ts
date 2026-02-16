import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/legacy/firebase/admin";
import { db as firestore } from "@/legacy/firebase/db-admin";
import { upsertUser } from "@/lib/user-service";

// Input validation
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
  // optional role on signup; default to "patient" and never allow "admin" via this route
  role: z.enum(["patient", "nurse"]).optional(),
});

async function ensureProfileDoc(
  uid: string,
  data: { email: string; displayName?: string | null; role?: "patient" | "nurse" }
) {
  // Sync to Firestore (Legacy)
  const profile = {
    id: uid,
    email: data.email,
    displayName: data.displayName ?? "",
    role: data.role ?? "patient",
    updatedAt: new Date().toISOString(),
  } as const;
  await firestore.collection("users").doc(uid).set(profile, { merge: true });

  // Sync to Postgres (V3 Source of Truth)
  await upsertUser({
    firebaseUid: uid,
    email: data.email,
    name: data.displayName,
    role: data.role,
  });

  return profile;
}

export async function POST(request: Request) {
  // Parse & validate
  const body = await request.json().catch(() => ({}));
  const parsed = SignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid input", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password, displayName, role } = parsed.data;

  try {
    // Try to create the auth user
    const userRecord = await adminAuth.createUser({ email, password, displayName });

    // Also ensure a Firestore profile doc exists/updated
    const profile = await ensureProfileDoc(userRecord.uid, { email, displayName, role });

    return NextResponse.json(
      {
        message: "User created successfully in Firebase Auth",
        uid: userRecord.uid,
        profile,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    // If the email already exists, treat the route as idempotent: fetch user and ensure profile doc
    if ((error as {code?: string})?.code === "auth/email-already-exists") {
      try {
        const existing = await adminAuth.getUserByEmail(email);
        const profile = await ensureProfileDoc(existing.uid, { email, displayName, role });
        return NextResponse.json(
          {
            message: "Email already existed; profile ensured/updated.",
            uid: existing.uid,
            profile,
          },
          { status: 200 }
        );
      } catch (e: unknown) {
        return NextResponse.json(
          { message: (e as Error)?.message ?? "Failed to reconcile existing user." },
          { status: 500 }
        );
      }
    }

    // Helpful diagnostics in local emulator workflows
    const emulatorHint = 
      process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST
        ? undefined
        : "(Tip: start emulators and export FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST)";

    console.error("Signup error:", error);
    return NextResponse.json(
      { message: (error as Error)?.message ?? "Unexpected error", hint: emulatorHint },
      { status: 500 }
    );
  }
}
