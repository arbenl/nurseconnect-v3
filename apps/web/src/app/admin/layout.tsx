import Link from "next/link";

import { requirePortalAccessOrRedirect } from "@/server/auth";

const adminNavItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/requests", label: "Active Queue" },
  { href: "/admin/requests/exceptions", label: "Exception Queue" },
  { href: "/admin/nurses", label: "Credential Queue" },
  { href: "/admin/activity", label: "Activity Feed" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePortalAccessOrRedirect({
    portal: "admin",
    currentPath: "/admin",
  });

  return (
    <div
      data-testid="admin-shell"
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_55%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-950"
    >
      <header className="border-b border-slate-200/80 bg-slate-950 text-slate-50 shadow-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
              NurseConnect Admin
            </p>
            <div className="text-xl font-semibold">Operations Console</div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-slate-700/80 px-3 py-1.5 text-slate-100 transition hover:border-sky-300/60 hover:bg-slate-900 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="text-sm text-slate-300 underline-offset-4 hover:text-white hover:underline"
          >
            Exit to App
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-600">Admin workspace</p>
            <p className="text-sm text-slate-500">
              Readable operational surfaces for queue review, credentialing, and incident handling.
            </p>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
