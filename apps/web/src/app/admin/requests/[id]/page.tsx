import { db, eq, schema } from "@nurseconnect/database";
import { notFound } from "next/navigation";

import { requireRole } from "@/server/auth";
import {
  RequestEventNotFoundError,
  getRequestEventsForUser,
} from "@/server/requests/request-events";
import { toLocationHint } from "@/server/requests/triage-severity";

const { serviceRequests } = schema;

type PageProps = {
  params: {
    id: string;
  };
};

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }
  return value.toLocaleString();
}

function actorLabel(actorUserId: string | null) {
  if (!actorUserId) {
    return "system";
  }
  return `actor:${actorUserId.slice(0, 8)}`;
}

export default async function AdminRequestDetailPage({ params }: PageProps) {
  const { user } = await requireRole("admin");

  const request = await db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, params.id),
  });

  if (!request) {
    notFound();
  }

  let events;
  try {
    events = await getRequestEventsForUser({
      requestId: request.id,
      actorUserId: user.id,
      actorRole: user.role,
    });
  } catch (error) {
    if (error instanceof RequestEventNotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>Request Detail</h1>
        <p style={{ opacity: 0.75, fontSize: "0.9rem" }}>
          Read-only admin timeline. PHI-safe summary fields only.
        </p>
      </div>

      <section
        style={{
          border: "1px solid #333",
          padding: "1rem",
          borderRadius: "8px",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "grid", gap: "0.5rem", fontSize: "0.9rem" }}>
          <div>
            <strong>Request:</strong> <span style={{ fontFamily: "monospace" }}>{request.id}</span>
          </div>
          <div>
            <strong>Status:</strong> {request.status}
          </div>
          <div>
            <strong>Assigned:</strong> {request.assignedNurseUserId ? "assigned" : "unassigned"}
          </div>
          <div>
            <strong>Location Hint:</strong>{" "}
            <span style={{ fontFamily: "monospace" }}>
              {toLocationHint(request.lat, request.lng, 2)}
            </span>
          </div>
          <div>
            <strong>Created:</strong> {formatDate(request.createdAt)}
          </div>
          <div>
            <strong>Updated:</strong> {formatDate(request.updatedAt)}
          </div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #333",
          borderRadius: "8px",
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Time</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Event</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Transition</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Actor</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "12px" }}>{new Date(event.createdAt).toLocaleString()}</td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>{event.type}</td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>
                  {(event.fromStatus ?? "-") + " -> " + (event.toStatus ?? "-")}
                </td>
                <td style={{ padding: "12px", fontFamily: "monospace" }}>{actorLabel(event.actorUserId)}</td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "1rem", opacity: 0.7 }}>
                  No events found for this request.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
