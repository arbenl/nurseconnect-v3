"use client";

import { createAuthClient } from "better-auth/react";

// If your Better Auth basePath is not `/api/auth`, pass the full URL including the path.
function getAuthBaseURL() {
  // Browser
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/better-auth`;
  }
  // Fallback (should not really be used in client runtime)
  return "http://localhost:3000/api/better-auth";
}

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
});

// Convenience re-exports (optional)
export const { useSession } = authClient;
