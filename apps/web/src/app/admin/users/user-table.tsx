"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type UserTableRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string | Date | null;
  role: "admin" | "nurse" | "patient" | "referral_partner";
  referralPartnerProfile: {
    organizationName: string;
    status: "active" | "inactive";
  } | null;
};

export default function UserTable({ users }: { users: UserTableRow[] }) {
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
    } catch {
      alert("Error updating role");
    } finally {
      setLoadingId(null);
    }
  }

  async function createPartnerProfile(userId: string) {
    const organizationName = window.prompt("Organization name");
    if (!organizationName) return;

    setLoadingId(userId);
    try {
      const res = await fetch("/api/admin/referral-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, organizationName }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch (_error) {
      alert("Error creating partner profile");
    } finally {
      setLoadingId(null);
    }
  }

  async function updatePartnerStatus(userId: string, status: "active" | "inactive") {
    setLoadingId(userId);
    try {
      const res = await fetch(`/api/admin/referral-partners/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch (_error) {
      alert("Error updating partner profile");
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
              <td style={{ padding: "12px", opacity: 0.7 }}>
                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "-"}
              </td>
              <td style={{ padding: "12px" }}>
                <span style={{ 
                  background:
                    u.role === "admin"
                      ? "#332b00"
                      : u.role === "nurse"
                        ? "#002b33"
                        : u.role === "referral_partner"
                          ? "#1f1a33"
                          : "#222",
                  color:
                    u.role === "admin"
                      ? "#ffc"
                      : u.role === "nurse"
                        ? "#cff"
                        : u.role === "referral_partner"
                          ? "#e7ddff"
                          : "#ccc",
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
                  {u.role !== "referral_partner" && (
                    <button
                      onClick={() => updateRole(u.id, "referral_partner")}
                      disabled={loadingId === u.id}
                      style={{ padding: "4px 8px", background: "#243", border: "none", borderRadius: "4px", cursor: "pointer", color: "white" }}
                    >
                      Make Partner
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
                  {u.role === "referral_partner" && !u.referralPartnerProfile && (
                    <button
                      onClick={() => createPartnerProfile(u.id)}
                      disabled={loadingId === u.id}
                      style={{ padding: "4px 8px", background: "#355", border: "none", borderRadius: "4px", cursor: "pointer", color: "white" }}
                    >
                      Create Partner
                    </button>
                  )}
                  {u.role === "referral_partner" && u.referralPartnerProfile?.status === "active" && (
                    <button
                      onClick={() => updatePartnerStatus(u.id, "inactive")}
                      disabled={loadingId === u.id}
                      style={{ padding: "4px 8px", background: "#633", border: "none", borderRadius: "4px", cursor: "pointer", color: "white" }}
                    >
                      Deactivate Partner
                    </button>
                  )}
                  {u.role === "referral_partner" && u.referralPartnerProfile?.status === "inactive" && (
                    <button
                      onClick={() => updatePartnerStatus(u.id, "active")}
                      disabled={loadingId === u.id}
                      style={{ padding: "4px 8px", background: "#253", border: "none", borderRadius: "4px", cursor: "pointer", color: "white" }}
                    >
                      Activate Partner
                    </button>
                  )}
                </div>
                {u.referralPartnerProfile && (
                  <div style={{ marginTop: "6px", fontSize: "0.75rem", opacity: 0.7 }}>
                    {u.referralPartnerProfile.organizationName} · {u.referralPartnerProfile.status}
                  </div>
                )}
              </td>
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
