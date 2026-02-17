import { redirect } from "next/navigation";

import { ensureDomainUserFromSession } from "@/lib/user-service";
import { getSession } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Check profile completion
  const user = await ensureDomainUserFromSession({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  if (!user) {
    // Should verify error handling here, but for now redirect or error
    redirect("/login");
  }

  // Check if profile is complete
  let isComplete = !!(
    user.firstName &&
    user.lastName &&
    user.phone &&
    user.city
  );

  if (isComplete && user.role === "nurse") {
    // Check nurse profile
    // We need to fetch nurse record. Since we are in RSC, we can use db directly or helper.
    // However, ensureDomainUserFromSession doesn't return nurse data.
    // We can import getNurseByUserId from user-service which is server-only safe.
    // But layout.tsx imports ensureDomainUserFromSession from @/lib/user-service.
    // Let's import getNurseByUserId from there too.
    const { getNurseByUserId } = await import("@/lib/user-service");
    const nurse = await getNurseByUserId(user.id);
    if (!nurse || !nurse.licenseNumber || !nurse.specialization) {
      isComplete = false;
    }
  }

  if (!isComplete) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
