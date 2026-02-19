import { getAdminUsers } from "@/server/admin/admin-reads";
import { requireRole } from "@/server/auth";

import UserTable from "./user-table"; // Client Component

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; limit?: string }>;
}) {
  await requireRole("admin");
  const query = await searchParams;
  const rawLimit = query.limit ? Number(query.limit) : 20;
  const normalizedLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 20;

  const data = await getAdminUsers({
    limit: normalizedLimit,
    cursor: query.cursor,
  });

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>User Management</h1>

      <UserTable users={data.items} />
      {data.nextCursor && (
        <div style={{ marginTop: "1rem" }}>
          <a
            href={`/admin/users?cursor=${encodeURIComponent(data.nextCursor)}&limit=${normalizedLimit}`}
            style={{ textDecoration: "underline" }}
          >
            Next page
          </a>
        </div>
      )}
    </div>
  );
}
