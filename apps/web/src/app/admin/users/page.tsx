import { requireRole } from "@/server/auth";
import { db, schema, ilike, or } from "@nurseconnect/database";
import UserTable from "./user-table"; // Client Component

const { users } = schema;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireRole("admin");
  const query = (await searchParams).q || "";

  // Simple search implementation
  const data = await db.query.users.findMany({
    where: query
      ? or(ilike(users.email, `%${query}%`), ilike(users.name, `%${query}%`))
      : undefined,
    limit: 50,
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>User Management</h1>
      
      {/* Search Form (Server Action or just GET param) */}
      <form style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem" }}>
        <input 
          name="q" 
          defaultValue={query} 
          placeholder="Search email or name..." 
          style={{ 
            padding: "8px", 
            borderRadius: "4px", 
            border: "1px solid #333", 
            background: "#000", 
            color: "#fff",
            width: "300px"
          }} 
        />
        <button type="submit" style={{ padding: "8px 16px", background: "#333", color: "#fff", border: "none", borderRadius: "4px" }}>
          Search
        </button>
      </form>

      <UserTable users={data} />
    </div>
  );
}
