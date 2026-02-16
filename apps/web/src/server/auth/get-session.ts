import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { env } from "@/env";

export async function getSession() {
  if (env.FEATURE_AUTH_PROVIDER === "nextauth") {
    // Legacy NextAuth Session
    return getServerSession(authOptions);
  }

  // Better-Auth Session
  return auth.api.getSession({
    headers: await headers(),
  });
}
