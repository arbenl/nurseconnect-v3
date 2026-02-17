import { requireRole } from "@/server/auth";

export default async function AdminDashboardPage() {
  const { user, session: _session } = await requireRole("admin");

  return (
    <div>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>Dashboard</h1>
      
      <div style={{ display: "grid", gap: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {/* Current Admin Session Card */}
        <section style={{ 
          border: "1px solid #333", 
          padding: "1.5rem", 
          borderRadius: "8px",
          background: "#0a0a0a"
        }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#888" }}>You (Session)</h2>
          <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.6 }}>ID:</span>
              <span style={{ fontFamily: "monospace" }}>{user.id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.6 }}>Email:</span>
              <span>{user.email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.6 }}>Role:</span>
              <span style={{ 
                background: "#332b00", 
                color: "#ffc", 
                padding: "2px 6px", 
                borderRadius: "4px",
                fontSize: "0.8rem"
              }}>{user.role}</span>
            </div>
            {user.firebaseUid && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ opacity: 0.6 }}>Firebase UID:</span>
                <span style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{user.firebaseUid}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ opacity: 0.6 }}>Provider:</span>
              <span style={{ fontFamily: "monospace" }}>
                Better-Auth
              </span>
            </div>
          </div>
        </section>

        {/* Quick Actions / Links */}
        <section style={{ 
          border: "1px solid #333", 
          padding: "1.5rem", 
          borderRadius: "8px",
          background: "#0a0a0a"
        }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#888" }}>Management</h2>
          <ul style={{ paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li>
              <a href="/admin/users" style={{ textDecoration: "underline" }}>Manage Users</a>
              <span style={{ marginLeft: "0.5rem", opacity: 0.6 }}>— Promote/demote roles</span>
            </li>
            <li>
              <a href="/admin/backfill" style={{ textDecoration: "underline" }}>Backfill Status</a>
              <span style={{ marginLeft: "0.5rem", opacity: 0.6 }}>— View migration progress</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
