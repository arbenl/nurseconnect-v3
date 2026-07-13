import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { TenantQueryObserver } from "./tenant-query-observer";

describe("tenant query observer", () => {
  it("exports a visible count and sanitized missing-context evidence", () => {
    const records: Record<string, unknown>[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const observer = new TenantQueryObserver({
      instanceId: "instance-one",
      runId: "run-one",
      write: (record) => records.push(record),
    });

    observer.logQuery(`SELECT * FROM service_requests WHERE address = $1`, ["Patient Address"]);

    expect(observer.snapshot()).toEqual({ trackedQueries: 1, violations: 1 });
    expect(records.map((record) => record.type)).toEqual(["ready", "tracked_query_seen", "violation"]);
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain("Patient Address");
    expect(serialized).not.toContain("SELECT");
    expect(serialized).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("deduplicates warnings without suppressing exact counts", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const observer = new TenantQueryObserver({ write: () => {} });

    observer.logQuery(`SELECT * FROM patients`, []);
    observer.logQuery(`SELECT * FROM patients`, []);

    expect(observer.snapshot().violations).toBe(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("records wrong-executor provenance once", () => {
    const records: Record<string, unknown>[] = [];
    const observer = new TenantQueryObserver({ write: (record) => records.push(record) });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    observer.recordWrongExecutor("request.create", "select");

    expect(observer.snapshot().violations).toBe(1);
    expect(records.at(-1)).toMatchObject({
      boundary: "request.create",
      operation: "select",
      reason: "wrong_executor",
      type: "violation",
    });
  });

  it.each(["findMany", "findFirst", "SELECT"])("normalizes %s provenance", (operation) => {
    const records: Record<string, unknown>[] = [];
    const observer = new TenantQueryObserver({ write: (record) => records.push(record) });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    observer.recordWrongExecutor("request.create", operation);

    expect(records.at(-1)).toMatchObject({ operation: "select", reason: "wrong_executor" });
  });

  it("fails closed when the harness sink rejects a violation", () => {
    const observer = new TenantQueryObserver({
      write: (record) => {
        if (record.type === "violation") throw new Error("sink unavailable");
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => observer.logQuery(`SELECT * FROM patients`, [])).toThrow("sink unavailable");
  });

  it("fails closed when the configured filesystem sink cannot accept records", () => {
    const directory = mkdtempSync(join(tmpdir(), "tenant-observer-sink-"));

    try {
      expect(() => new TenantQueryObserver({ runId: "run-one", sinkPath: directory })).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects incomplete harness configuration", () => {
    expect(() => new TenantQueryObserver({ runId: "run-one" })).toThrow(
      "Tenant observation harness configuration is incomplete",
    );
  });

  it("records oversized input without retaining query content", () => {
    const records: Record<string, unknown>[] = [];
    const observer = new TenantQueryObserver({ write: (record) => records.push(record) });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    observer.logQuery(`SELECT '${"private".repeat(50_000)}'`, []);

    expect(records.at(-1)).toMatchObject({ reason: "oversize_query", operation: "unknown" });
    expect(JSON.stringify(records)).not.toContain("private");
  });
});
