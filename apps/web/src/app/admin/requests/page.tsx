import Link from "next/link";

import { requireRole } from "@/server/auth";
import { getAdminActiveRequestQueue } from "@/server/requests/admin-active-queue";

function severityColor(band: "critical" | "high" | "medium" | "low") {
  switch (band) {
    case "critical":
      return { bg: "#4a0f1a", fg: "#ffd5dd" };
    case "high":
      return { bg: "#4a2f0f", fg: "#ffe2bd" };
    case "medium":
      return { bg: "#2f350f", fg: "#e8f1b5" };
    default:
      return { bg: "#1e293b", fg: "#dbeafe" };
  }
}

export default async function AdminRequestsPage() {
  await requireRole("admin");
  const queue = await getAdminActiveRequestQueue({ limit: 200 });

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Active Requests Queue</h1>
        <p style={{ opacity: 0.75, fontSize: "0.9rem" }}>
          Read-only triage feed. PHI-safe view (no patient identity or full address).
        </p>
      </div>

      <div style={{ marginBottom: "1rem", fontSize: "0.85rem", opacity: 0.7 }}>
        Generated at: {new Date(queue.generatedAt).toLocaleString()}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Request</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Severity</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Wait (min)</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Last Event</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Assigned</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Location Hint</th>
            </tr>
          </thead>
          <tbody>
            {queue.items.map((item) => {
              const colors = severityColor(item.severityBand);
              return (
                <tr key={item.requestId} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "12px", fontFamily: "monospace" }}>
                    <Link
                      href={`/admin/requests/${item.requestId}`}
                      style={{ textDecoration: "underline", textUnderlineOffset: "2px" }}
                    >
                      {item.requestId}
                    </Link>
                  </td>
                  <td style={{ padding: "12px" }}>{item.status}</td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        background: colors.bg,
                        color: colors.fg,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.8rem",
                        marginRight: "0.5rem",
                      }}
                    >
                      {item.severityBand}
                    </span>
                    <span style={{ opacity: 0.85 }}>{item.severityScore}</span>
                  </td>
                  <td style={{ padding: "12px" }}>{item.waitMinutes}</td>
                  <td style={{ padding: "12px" }}>{new Date(item.lastEventAt).toLocaleString()}</td>
                  <td style={{ padding: "12px" }}>{item.assignedNurse}</td>
                  <td style={{ padding: "12px", fontFamily: "monospace" }}>{item.locationHint}</td>
                </tr>
              );
            })}
            {queue.items.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "2rem", textAlign: "center", opacity: 0.6 }}>
                  No active requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
