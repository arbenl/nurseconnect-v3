import { notFound } from "next/navigation";

import { AdminRequestNotFoundError } from "@/server/admin/admin-reads";
import { getAdminRequestDetail } from "@/server/admin/admin-reads";
import { requireRole } from "@/server/auth";

export default async function AdminRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await requireRole("admin");
  const { id } = await params;

  try {
    const detail = await getAdminRequestDetail({ requestId: id, actorUserId: user.id });

    return (
      <div>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Request Detail</h1>
        <section style={{ marginBottom: "1.5rem", border: "1px solid #333", borderRadius: 8, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Request</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.85rem" }}>
            {JSON.stringify(detail.request, null, 2)}
          </pre>
        </section>

        <section style={{ border: "1px solid #333", borderRadius: 8, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>Timeline</h2>
          <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.5rem" }}>
            {detail.events.map((event) => (
              <li key={event.id}>
                <div style={{ fontWeight: "bold" }}>{event.type}</div>
                <div style={{ opacity: 0.8, fontSize: "0.85rem" }}>
                  Actor: {event.actorUserId ?? "system"} • from {event.fromStatus ?? "-"} to {event.toStatus ?? "-"}
                </div>
                <div style={{ opacity: 0.6, fontSize: "0.75rem" }}>{new Date(event.createdAt).toLocaleString()}</div>
              </li>
            ))}
            {detail.events.length === 0 && <li>No events</li>}
          </ol>
        </section>
      </div>
    );
  } catch (error) {
    if (error instanceof AdminRequestNotFoundError) {
      notFound();
    }

    throw error;
  }
}
