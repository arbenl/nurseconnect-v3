export type TenantObservationEvidence = {
  instances: number;
  readyRecords: number;
  trackedQueryRecords: number;
  violationCount: number;
};

type EvidenceRecord = {
  instance: string;
  run: string;
  type: "ready" | "tracked_query_seen" | "violation";
  v: number;
};

export function parseTenantObservationEvidence(
  content: string,
  expectedRun: string,
  options: { allowInactiveObserver?: boolean; requireTrackedQuery?: boolean } = {},
): TenantObservationEvidence {
  const lines = content.split("\n").filter((line) => line.length > 0);
  if (lines.length === 0 && options.allowInactiveObserver) {
    return { instances: 0, readyRecords: 0, trackedQueryRecords: 0, violationCount: 0 };
  }
  if (lines.length === 0) throw new Error("Tenant observation evidence is empty");

  const records = lines.map(parseRecord);
  if (records.some((record) => record.run !== expectedRun)) {
    throw new Error("Tenant observation evidence run does not match");
  }

  const readyRecords = records.filter((record) => record.type === "ready");
  const trackedQueryRecords = records.filter((record) => record.type === "tracked_query_seen");
  const violationCount = records.filter((record) => record.type === "violation").length;
  if (readyRecords.length === 0) throw new Error("Tenant observer did not report ready");
  if (options.requireTrackedQuery !== false && trackedQueryRecords.length === 0) {
    throw new Error("Tenant observer saw no tracked query");
  }

  const readyInstances = new Set(readyRecords.map((record) => record.instance));
  if (records.some((record) => !readyInstances.has(record.instance))) {
    throw new Error("Tenant observation instance did not report ready");
  }

  return {
    instances: readyInstances.size,
    readyRecords: readyRecords.length,
    trackedQueryRecords: trackedQueryRecords.length,
    violationCount,
  };
}

function parseRecord(line: string): EvidenceRecord {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    throw new Error("Tenant observation evidence is malformed");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Tenant observation record is invalid");
  }
  const record = value as Record<string, unknown>;
  if (
    record.v !== 1 ||
    typeof record.run !== "string" ||
    typeof record.instance !== "string" ||
    !["ready", "tracked_query_seen", "violation"].includes(String(record.type))
  ) {
    throw new Error("Tenant observation record schema is invalid");
  }
  return record as EvidenceRecord;
}
