"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserTable({ users }: { users: any[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function updateRole(id: string, newRole: string) {
    if (!confirm(`Are you sure you want to change role to ${newRole}?`)) return;
    setLoadingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch (e) {
      alert("Error updating role");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: "8px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
        <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
          <tr>
            <th style={{ padding: "12px", textAlign: "left" }}>Email / Name</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Firebase UID</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Start Date</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Role</th>
            <th style={{ padding: "12px", textAlign: "left" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "12px" }}>
                <div style={{ fontWeight: 500 }}>{u.email}</div>
                <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>{u.name}</div>
                <div style={{ opacity: 0.4, fontSize: "0.75rem", fontFamily: "monospace" }}>{u.id}</div>
              </td>
              <td style={{ padding: "12px", fontFamily: "monospace", opacity: 0.8 }}>
                {u.firebaseUid || "-"}
              </td>
              <td style={{ padding: "12px", opacity: 0.7 }}>
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
              </td>
              <td style={{ padding: "12px" }}>
                <span style={{ 
                  background: u.role === "admin" ? "#332b00" : u.role === "nurse" ? "#002b33" : "#222",
                  color: u.role === "admin" ? "#ffc" : u.role === "nurse" ? "#cff" : "#ccc",
                  padding: "2px 6px",
                  borderRadius: "4px"
                }}>
                  {u.role}
                </span>
              </td>
              <td style={{ padding: "12px" }}>
                <div style={{ display: "flex", gap: "6px" }}>
                  {u.role !== "admin" && (
                    <button 
                      onClick={() => updateRole(u.id, "admin")}
                      disabled={loadingId === u.id}
                      style={{ padding: "4px 8px", background: "#333", border: "none", borderRadius: "4px", cursor: "pointer", color: "white" }}
                    >
                      Promote
                    </button>
                  )}
                  {u.role === "admin" && (
                     <button 
                      onClick={() => updateRole(u.id, "patient")}
                      disabled={loadingId === u.id}
                      style={{ padding: "4px 8px", background: "#522", border: "none", borderRadius: "4px", cursor: "pointer", color: "white" }}
                    >
                      Demote
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>
                No users found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
