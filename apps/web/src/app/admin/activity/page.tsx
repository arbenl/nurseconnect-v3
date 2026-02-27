import { requireRole } from "@/server/auth";
import { getAdminReassignmentActivityFeed } from "@/server/admin/activity-feed";

function shortId(value: string | null) {
  if (!value) {
    return "-";
  }
  return value.slice(0, 8);
}

function transitionLabel(previousNurseUserId: string | null, newNurseUserId: string | null) {
  return `${shortId(previousNurseUserId)} -> ${shortId(newNurseUserId)}`;
}

export default async function AdminActivityPage() {
  await requireRole("admin");
  const activity = await getAdminReassignmentActivityFeed(200);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Reassignment Activity Feed</h1>
        <p style={{ opacity: 0.75, fontSize: "0.9rem" }}>
          Unified audit timeline for reassignment actions with PHI-safe metadata.
        </p>
      </div>

      <div style={{ marginBottom: "1rem", fontSize: "0.85rem", opacity: 0.7 }}>
        Generated at: {new Date(activity.generatedAt).toLocaleString()}
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Time</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Source</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Request</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Actor</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Nurse Transition</th>
              <th style={{ padding: "12px", textAlign: "left" }}>State</th>
            </tr>
          </thead>
          <tbody>
            {activity.items.map((item) => (
              <tr key={`${item.source}:${item.id}`} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "12px" }}>{new Date(item.createdAt).toLocaleString()}</td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>{item.source}</td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>{item.requestId.slice(0, 8)}</td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>{shortId(item.actorUserId)}</td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>
                  {transitionLabel(item.metadata.previousNurseUserId, item.metadata.newNurseUserId)}
                </td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>
                  {item.source === "request-event"
                    ? `${item.fromStatus ?? "-"} -> ${item.toStatus ?? "-"}`
                    : item.action}
                </td>
              </tr>
            ))}
            {activity.items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", opacity: 0.6 }}>
                  No reassignment events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
