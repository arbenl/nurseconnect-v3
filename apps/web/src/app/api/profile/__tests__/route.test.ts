import { vi, describe, it, expect, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Hoisted mocks for db-admin and next-auth.
 * We import route handlers AFTER mocks to avoid hoisting issues.
 */

vi.mock("@/legacy/firebase/db-admin", () => {
  const setMock = vi.fn();
  const getMock = vi.fn();
  const docMock = vi.fn(() => ({ set: setMock, get: getMock }));
  const collectionMock = vi.fn(() => ({ doc: docMock }));
  return { db: { collection: collectionMock } };
});

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Lazy imports after mocks are set
const { db } = await import("@/legacy/firebase/db-admin");
const { getServerSession } = await import("next-auth");

function makeReq(url: string, method: "GET" | "PUT", body?: any): NextRequest {
  const u = new URL(url);
  const headers = new Headers();
  headers.set("x-forwarded-for", "127.0.0.1");
  return {
    method,
    url: u.toString(),
    headers,
    json: async () => body,
  } as unknown as NextRequest;
}

// convenience access to inner mock fns for assertions
const getCollectionMock = (db.collection as ReturnType<typeof vi.fn>);
const getDocMock = getCollectionMock().doc as any;
const getSetMock = getDocMock().set as any;
const getGetMock = getDocMock().get as any;

describe("Profile API", () => {
  // Import route handlers after resetting modules to ensure mocks apply
  let GET: typeof import("../route").GET;
  let PUT: typeof import("../route").PUT;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({ GET, PUT } = await import("../route"));
  });

  it("GET denies when not authenticated", async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(makeReq("http://localhost/api/profile", "GET"));
    expect(res.status).toBe(401);
  });

  it("GET returns default shell when no doc", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", name: "Jane" } });
    getGetMock.mockResolvedValueOnce({ exists: false });
    const res = await GET(makeReq("http://localhost/api/profile", "GET"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ id: "u1", role: "patient", displayName: "Jane" });
    expect(getCollectionMock).toHaveBeenCalledWith("users");
    expect(getDocMock).toHaveBeenCalledWith("u1");
  });

  it("PUT prevents self-elevation to admin", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: "patient" } });
    const res = await PUT(makeReq("http://localhost/api/profile", "PUT", { role: "admin" }));
    expect(res.status).toBe(403);
  });

  it("PUT merges allowed updates (e.g. patient -> nurse)", async () => {
    (getServerSession as any).mockResolvedValue({ user: { id: "u1", role: "patient" } });
    const res = await PUT(makeReq("http://localhost/api/profile", "PUT", { role: "nurse", displayName: "J" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ id: "u1", role: "nurse", displayName: "J" });
    expect(getSetMock).toHaveBeenCalledWith({ role: "nurse", displayName: "J" }, { merge: true });
  });
});