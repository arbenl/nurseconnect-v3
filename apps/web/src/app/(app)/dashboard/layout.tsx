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
  const isComplete = !!(
    user.firstName &&
    user.lastName &&
    user.phone &&
    user.city
  );

  console.log("[Guard] User:", user.email, "Complete:", isComplete);

  if (!isComplete) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
