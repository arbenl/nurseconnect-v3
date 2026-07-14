import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

import type { Logger } from "drizzle-orm/logger";

import { getTenantObservationContext, type TenantBoundary } from "./tenant-context";
import { classifyTenantQuery, type QueryOperation, type TenantTable } from "./tenant-query-classifier";

type ViolationReason = "missing_context" | "oversize_query" | "wrong_executor";
type ObservationRecord = Record<string, boolean | number | string | string[]>;

export type TenantObservationSnapshot = {
  trackedQueries: number;
  violations: number;
};

type ObserverOptions = {
  instanceId?: string;
  runId?: string;
  sinkPath?: string;
  write?: (record: ObservationRecord) => void;
};

export class TenantQueryObserver implements Logger {
  private readonly instanceId: string;
  private readonly runId?: string;
  private readonly sinkPath?: string;
  private readonly writeOverride?: (record: ObservationRecord) => void;
  private readonly warned = new Set<string>();
  private trackedQueries = 0;
  private violations = 0;
  private trackedSeenWritten = false;

  constructor(options: ObserverOptions = {}) {
    this.instanceId = options.instanceId ?? randomUUID();
    this.runId = options.runId;
    this.sinkPath = options.sinkPath;
    this.writeOverride = options.write;
    if (Boolean(this.runId) !== Boolean(this.sinkPath) && !this.writeOverride) {
      throw new Error("Tenant observation harness configuration is incomplete");
    }
    this.write({ type: "ready" });
  }

  logQuery(query: string, _params: unknown[]): void {
    const classification = classifyTenantQuery(query);
    if (classification.oversize) {
      this.recordViolation("oversize_query", "unknown", [], "unknown");
      return;
    }
    if (classification.tables.length === 0) return;

    this.trackedQueries += 1;
    if (!this.trackedSeenWritten) {
      this.write({ type: "tracked_query_seen" });
      this.trackedSeenWritten = true;
    }
    if (!getTenantObservationContext()) {
      this.recordViolation("missing_context", "unscoped", classification.tables, classification.operation);
    }
  }

  recordWrongExecutor(boundary: TenantBoundary, operation: string): void {
    this.recordViolation("wrong_executor", boundary, [], safeOperation(operation));
  }

  snapshot(): TenantObservationSnapshot {
    return { trackedQueries: this.trackedQueries, violations: this.violations };
  }

  private recordViolation(
    reason: ViolationReason,
    boundary: TenantBoundary | "unknown" | "unscoped",
    tables: TenantTable[],
    operation: QueryOperation,
  ): void {
    this.violations += 1;
    const record = { type: "violation", boundary, reason, operation, tables, count: this.violations };
    this.write(record);
    const warningKey = JSON.stringify({ boundary, reason, operation, tables });
    if (!this.warned.has(warningKey)) {
      this.warned.add(warningKey);
      console.warn(JSON.stringify({ event: "tenant_scope_violation", ...record }));
    }
  }

  private write(record: ObservationRecord): void {
    const envelope = { v: 1, run: this.runId ?? "process", instance: this.instanceId, ...record };
    if (this.writeOverride) {
      this.writeOverride(envelope);
      return;
    }
    if (this.sinkPath && this.runId) {
      appendFileSync(this.sinkPath, `${JSON.stringify(envelope)}\n`, { encoding: "utf8", flag: "a" });
    }
  }
}

function safeOperation(operation: string): QueryOperation {
  const normalized = operation.toLowerCase();
  if (normalized === "findmany" || normalized === "findfirst") return "select";
  if (normalized === "insert" || normalized === "update" || normalized === "delete" || normalized === "select") {
    return normalized;
  }
  return "unknown";
}

const globalForObserver = globalThis as unknown as { __tenantQueryObserver?: TenantQueryObserver };

export const tenantQueryObserver = globalForObserver.__tenantQueryObserver ?? new TenantQueryObserver({
  runId: process.env.TENANT_SCOPE_OBSERVATION_RUN,
  sinkPath: process.env.TENANT_SCOPE_VIOLATION_FILE,
});

if (process.env.NODE_ENV !== "production") globalForObserver.__tenantQueryObserver = tenantQueryObserver;

export function getTenantObservationSnapshot(): TenantObservationSnapshot {
  return tenantQueryObserver.snapshot();
}
