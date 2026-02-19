"use client";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "nurse" | "patient";
  authId: string | null;
  firebaseUid: string | null;
  createdAt: string;
};

export default function UserTable({ users }: { users: AdminUser[] }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: "8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
          <tr>
            <th style={{ padding: "12px", textAlign: "left" }}>Email / Name</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Auth + Firebase IDs</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Role</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "12px" }}>
                <div style={{ fontWeight: 500 }}>{u.email}</div>
                <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>{u.name ?? "-"}</div>
                <div style={{ opacity: 0.4, fontSize: "0.75rem", fontFamily: "monospace" }}>{u.id}</div>
              </td>
              <td style={{ padding: "12px", fontFamily: "monospace", opacity: 0.8, fontSize: "0.8rem", maxWidth: "320px" }}>
                <div>{u.authId || "-"}</div>
                <div>{u.firebaseUid || "-"}</div>
              </td>
              <td style={{ padding: "12px" }}>
                <span
                  style={{
                    background: u.role === "admin" ? "#332b00" : u.role === "nurse" ? "#002b33" : "#222",
                    color: u.role === "admin" ? "#ffc" : u.role === "nurse" ? "#cff" : "#ccc",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {u.role}
                </span>
              </td>
              <td style={{ padding: "12px", opacity: 0.7 }}>{new Date(u.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
