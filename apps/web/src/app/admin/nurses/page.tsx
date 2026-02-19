import Link from "next/link";

import { getAdminNurses } from "@/server/admin/admin-reads";
import { requireRole } from "@/server/auth";

export default async function AdminNursesPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; limit?: string }>;
}) {
  await requireRole("admin");

  const query = await searchParams;
  const limit = Number(query.limit ?? 20);

  const data = await getAdminNurses({
    limit: Number.isFinite(limit) ? limit : 20,
    cursor: query.cursor,
  });

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Nurses</h1>
      <div style={{ overflowX: "auto", border: "1px solid #333", borderRadius: "8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead style={{ background: "#111", borderBottom: "1px solid #333" }}>
            <tr>
              <th style={{ padding: "12px", textAlign: "left" }}>User ID</th>
              <th style={{ padding: "12px", textAlign: "left" }}>License</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Specialization</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Available</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((nurse) => (
              <tr key={nurse.id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ padding: "12px" }}>
                  <div style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{nurse.userId}</div>
                  <div style={{ opacity: 0.6, fontSize: "0.75rem" }}>{nurse.email}</div>
                  <div>{nurse.name ?? "-"}</div>
                </td>
                <td style={{ padding: "12px" }}>{nurse.licenseNumber ?? "-"}</td>
                <td style={{ padding: "12px" }}>{nurse.specialization ?? "-"}</td>
                <td style={{ padding: "12px" }}>{nurse.status}</td>
                <td style={{ padding: "12px" }}>{nurse.isAvailable ? "Yes" : "No"}</td>
                <td style={{ padding: "12px" }}>{new Date(nurse.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}>
                  No nurses found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data.nextCursor && (
        <div style={{ marginTop: "1rem" }}>
          <Link
            href={`/admin/nurses?cursor=${encodeURIComponent(data.nextCursor)}&limit=${limit}`}
            style={{ textDecoration: "underline" }}
          >
            Next page
          </Link>
        </div>
      )}
    </div>
  );
}
