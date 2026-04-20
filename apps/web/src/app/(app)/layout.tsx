import { Home } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { getAppShellConfig } from "@/lib/app-shell-nav";
import { requirePortalAccessOrRedirect } from "@/server/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePortalAccessOrRedirect({
    portal: "app",
    currentPath: "/dashboard",
  });

  const shellRole =
    user.role === "nurse"
      ? "nurse"
      : user.role === "referral_partner"
        ? "partner"
        : "patient";
  const shell = getAppShellConfig(shellRole);

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <aside className="hidden border-r bg-muted/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex min-h-24 flex-col items-start justify-center gap-2 border-b px-4 py-4 lg:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span>NurseConnect</span>
            </Link>
            <Badge variant="secondary" className="rounded-full">
              {shell.portalLabel}
            </Badge>
            <p className="text-sm text-muted-foreground">{shell.summary}</p>
          </div>
          <div className="flex-1">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
              {shell.navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg bg-muted px-3 py-2 text-primary transition-all hover:text-primary"
                >
                  <Home className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </aside>
      <div className="flex flex-col">
        <header className="flex min-h-16 items-center border-b bg-muted/40 px-4 py-3 lg:px-6">
          <div className="flex flex-col gap-1">
            <Link href="/" className="font-semibold md:hidden">
              NurseConnect
            </Link>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground" data-testid="app-shell-role">
                {shell.portalLabel}
              </p>
              <Badge variant="outline" className="hidden rounded-full sm:inline-flex">
                {user.role}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{shell.summary}</p>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pb-8 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
