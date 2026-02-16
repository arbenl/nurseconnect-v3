import { requireRole } from "@/server/auth";
import { db, schema, isNotNull, isNull, sql, count } from "@nurseconnect/database";

const { users } = schema;

export default async function AdminBackfillPage() {
  await requireRole("admin");

  // DB Counts
  const [totalRes] = await db.select({ value: count() }).from(users);
  const total = totalRes.value;

  const [linkedRes] = await db.select({ value: count() }).from(users).where(isNotNull(users.firebaseUid));
  const linked = linkedRes.value;

  const [missingEmailRes] = await db.select({ value: count() }).from(users).where(isNull(users.email));
  const missingEmail = missingEmailRes.value;

  // Use a raw SQL for recent or just count (drizzle count() helper is nice)
  // For recent, let's just show raw count for now to keep it simple and type-safe
  
  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>Backfill Status</h1>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "2rem" }}>
        <StatCard label="Total Users" value={total} />
        <StatCard label="Linked (Firebase UID)" value={linked} color="#cfc" />
        <StatCard label="Unlinked" value={total - linked} color="#fcc" />
        <StatCard label="Missing Email" value={missingEmail} />
      </div>

      <section style={{ 
        border: "1px solid #333", 
        padding: "1.5rem", 
        borderRadius: "8px",
        background: "#0a0a0a"
      }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "#888" }}>Migration Runbook</h2>
        <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
          Follow the protocol in <code>docs/migration/auth-cutover.md</code>.
        </p>
        <pre style={{ padding: "1rem", background: "#111", overflowX: "auto" }}>
{`# 1. Export
firebase auth:export tmp/firebase-users.json --format=json

# 2. Backfill (Dry Run)
pnpm tsx scripts/backfill-users.ts --input tmp/firebase-users.json

# 3. Backfill (Apply)
pnpm tsx scripts/backfill-users.ts --input tmp/firebase-users.json --apply`}
        </pre>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string, value: number, color?: string }) {
  return (
    <div style={{ padding: "1.5rem", border: "1px solid #333", borderRadius: "8px", background: "#111" }}>
      <div style={{ opacity: 0.6, fontSize: "0.9rem", marginBottom: "0.5rem" }}>{label}</div>
      <div style={{ fontSize: "2rem", fontWeight: "bold", color: color || "#fff" }}>{value}</div>
    </div>
  );
}
