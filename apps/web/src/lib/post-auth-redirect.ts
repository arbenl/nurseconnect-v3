import { normalizeCallbackUrlForRole } from "./canonical-routes";

type MeResponse = {
  user?: {
    role?: string | null;
  } | null;
};

export async function resolvePostAuthRedirectTarget(
  callbackUrl?: string | null,
): Promise<string> {
  const response = await fetch("/api/me", { credentials: "include" });

  if (!response.ok) {
    throw new Error("Failed to resolve signed-in user");
  }

  const payload = (await response.json()) as MeResponse;
  return normalizeCallbackUrlForRole(payload?.user?.role ?? null, callbackUrl);
}
