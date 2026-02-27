import Link from "next/link";
import { redirect } from "next/navigation";

import { requireRole } from "@/server/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole("admin");
  } catch {
    // Basic protection: redirect to smoke page (or login) if not admin
    redirect("/smoke/auth");
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ 
        background: "#111", 
        borderBottom: "1px solid #333", 
        padding: "1rem 2rem",
        display: "flex",
        alignItems: "center",
        gap: "2rem"
      }}>
        <div style={{ fontWeight: "bold", fontSize: "1.2rem" }}>Admin</div>
        <nav style={{ display: "flex", gap: "1rem" }}>
          <Link href="/admin" style={{ opacity: 0.8 }}>Dashboard</Link>
          <Link href="/admin/requests" style={{ opacity: 0.8 }}>Active Queue</Link>
          <Link href="/admin/activity" style={{ opacity: 0.8 }}>Activity Feed</Link>
          <Link href="/admin/users" style={{ opacity: 0.8 }}>Users</Link>
          <Link href="/admin/backfill" style={{ opacity: 0.8 }}>Backfill Status</Link>
        </nav>
        <div style={{ marginLeft: "auto" }}>
          <Link href="/" style={{ fontSize: "0.9rem", opacity: 0.6 }}>Exit to App</Link>
        </div>
      </header>
      <main style={{ flex: 1, padding: "2rem", maxWidth: "1200px", margin: "0 auto", width: "100%" }}>
        {children}
      </main>
    </div>
  );
}
