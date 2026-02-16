import type { Firestore } from "firebase/firestore";
import { doc, getDoc, setDoc } from "firebase/firestore";

type MinimalUser = {
  id: string;
  email?: string | null;
  displayName?: string | null;
};

/**
 * Idempotent profile ensure on sign-in.
 * Pure (db is injected), easy to unit test without emulators.
 */
export async function onUserSignIn(
  db: Firestore,
  user: MinimalUser,
): Promise<void> {
  const userRef = doc(db, "users", user.id);
  const snap = await getDoc(userRef);

  const exists =
    typeof (snap as any)?.exists === "function"
      ? (snap as any).exists()
      : false;

  if (!exists) {
    await setDoc(
      userRef,
      {
        uid: user.id,
        email: user.email ?? "",
        displayName: user.displayName ?? "",
        roles: ["staff"],
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }
}
