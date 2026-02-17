
export async function getSession() {
  // Direct Better-Auth path (V3 standard)
  const { auth } = await import("@/lib/auth");
  const { headers } = await import("next/headers");
  return auth.api.getSession({
    headers: await headers(),
  });
}
