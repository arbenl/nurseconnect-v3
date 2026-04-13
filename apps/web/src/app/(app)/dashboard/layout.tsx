import { requirePortalAccessOrRedirect } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePortalAccessOrRedirect({
    portal: "app",
    currentPath: "/dashboard",
    requireProfileComplete: true,
  });

  return <>{children}</>;
}
