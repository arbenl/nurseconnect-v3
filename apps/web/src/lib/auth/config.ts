import { FirestoreAdapter } from "@next-auth/firebase-adapter";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/legacy/firebase/firebaseClient"; // for callbacks
import { adminDb, adminAuth } from "@/legacy/firebase/admin"; // for adapter


export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "test@example.com" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Check if user exists in Firebase Auth
          const userRecord = await adminAuth.getUserByEmail(credentials.email);

          // This is a simplified check. In a real app, you'd want to
          // verify the password here, for example by calling signInWithEmailAndPassword
          // on the client and passing the ID token to the backend to be verified.
          // For this demo, we are not checking the password.

          return {
            id: userRecord.uid,
            email: userRecord.email,
            name: userRecord.displayName,
          };
        } catch (error: any) {
          if (error.code === "auth/user-not-found") {
            // Return null if user is not found
            return null;
          } else {
            console.error("Error in authorize callback:", error);
            return null;
          }
        }
      },
    }),
  ],
  adapter: FirestoreAdapter(adminDb),
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const userDoc = await getDoc(doc(db, "users", user.id));
        const userData = userDoc.data();
        token.id = user.id;
        token.role = userData?.role || "nurse";


      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};