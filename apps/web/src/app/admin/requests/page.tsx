import Link from "next/link";
import { z } from "zod";

import { getAdminRequests } from "@/server/admin/admin-reads";
import { requireRole } from "@/server/auth";

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; limit?: string; status?: string }>;
}) {
  await requireRole("admin");

  const query = await searchParams;
  const limit = Number(query.limit ?? 20);

  const statusParse = z
    .enum(["open", "assigned", "accepted", "enroute", "completed", "canceled", "rejected"])
    .safeParse(query.status);

  const data = await getAdminRequests({
    limit: Number.isFinite(limit) ? limit : 20,
    cursor: query.cursor,
    status: statusParse.success ? statusParse.data : undefined,
  });

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Requests</h1>
      <div style={{ marginBottom: "1rem" }}>
        <span style={{ opacity: 0.6 }}>Status filter:</span>{" "}
        {["open", "assigned", "accepted", "enroute", "completed", "canceled", "rejected"].map((status) => (
          <a
            key={status}
            href={`/admin/requests?status=${status}`}
            style={{
              marginLeft: "0.75rem",
              textDecoration: query.status === status ? "underline" : "none",
            }}
          >
            {status}
          </a>
        ))}
      </div>
      <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>Request ID</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Patient</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Updated</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Nurse</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((request) => (
              <tr key={request.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "12px" }}>
                  <Link href={`/admin/requests/${request.id}`} style={{ textDecoration: "underline" }}>
                    {request.id}
                  </Link>
                  <div style={{ opacity: 0.6, fontSize: "0.8rem" }}>{request.address}</div>
                </td>
                <td style={{ padding: "12px", fontFamily: "monospace", fontSize: "0.8rem" }}>{request.patientUserId}</td>
                <td style={{ padding: "12px" }}>{request.status}</td>
                <td style={{ padding: "12px", opacity: 0.7 }}>{new Date(request.updatedAt).toLocaleString()}</td>
                <td style={{ padding: "12px", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {request.assignedNurseUserId ?? "-"}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>
                  No requests found
                </td>
              </tr>
              )}
          </tbody>
        </table>
      </div>
      {data.nextCursor && (
        <div style={{ marginTop: "1rem" }}>
          <Link
            href={`/admin/requests?cursor=${encodeURIComponent(data.nextCursor)}&limit=${limit}${
              query.status ? `&status=${query.status}` : ""
            }`}
            style={{ textDecoration: "underline" }}
          >
            Next page
          </Link>
        </div>
      )}
    </div>
  );
}
