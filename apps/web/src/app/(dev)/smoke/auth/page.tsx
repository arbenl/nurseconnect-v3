"use client";

import { useEffect, useState } from "react";

type ApiState = {
  loading: boolean;
  status?: number;
  body?: any;
  error?: string;
};

async function callJson(url: string): Promise<{ status: number; body: any }> {
  const res = await fetch(url, { credentials: "include" });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

export default function AuthSmokePage() {
  const [me, setMe] = useState<ApiState>({ loading: false });
  const [adminPing, setAdminPing] = useState<ApiState>({ loading: false });

  async function runMe() {
    setMe({ loading: true });
    try {
      const out = await callJson("/api/me");
      setMe({ loading: false, ...out });
    } catch (e) {
      setMe({ loading: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  async function runAdminPing() {
    setAdminPing({ loading: true });
    try {
      const out = await callJson("/api/admin/ping");
      setAdminPing({ loading: false, ...out });
    } catch (e) {
      setAdminPing({ loading: false, error: e instanceof Error ? e.message : "Unknown error" });
    }
  }

  useEffect(() => {
    // Auto-run on load for convenience
    void runMe();
    void runAdminPing();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Auth + RBAC Smoke</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        This page verifies Better-Auth session bootstrap (/api/me) and RBAC enforcement (/api/admin/ping).
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>1) /api/me (bootstrap)</h2>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={runMe} disabled={me.loading}>
            {me.loading ? "Running..." : "Run /api/me"}
          </button>
        </div>
        <pre style={{ marginTop: 12, padding: 12, background: "#111", color: "#eee", overflowX: "auto" }}>
{JSON.stringify(
  { status: me.status, body: me.body, error: me.error },
  null,
  2
)}
        </pre>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>2) /api/admin/ping (RBAC)</h2>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={runAdminPing} disabled={adminPing.loading}>
            {adminPing.loading ? "Running..." : "Run /api/admin/ping"}
          </button>
        </div>
        <pre style={{ marginTop: 12, padding: 12, background: "#111", color: "#eee", overflowX: "auto" }}>
{JSON.stringify(
  { status: adminPing.status, body: adminPing.body, error: adminPing.error },
  null,
  2
)}
        </pre>

        <ul style={{ marginTop: 12 }}>
          <li><code>401</code> = not logged in</li>
          <li><code>403</code> = logged in, but role is not admin</li>
          <li><code>200</code> = admin OK</li>
        </ul>
      </section>
    </main>
  );
}
