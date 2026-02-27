import type {
  ActiveRequestStatus,
  AdminActiveRequestQueueItem,
  RequestSeverityBand,
} from "@nurseconnect/contracts";

export const ACTIVE_REQUEST_STATUSES: ActiveRequestStatus[] = [
  "open",
  "assigned",
  "accepted",
  "enroute",
];

export type TriageSeverityPolicy = {
  statusWeights: Record<ActiveRequestStatus, number>;
  waitWeightPerMinute: number;
  waitMinutesCap: number;
  unassignedBonus: number;
  staleEventThresholdMinutes: number;
  staleEventBonus: number;
  bandThresholds: {
    critical: number;
    high: number;
    medium: number;
  };
  locationPrecision: number;
};

export const DEFAULT_TRIAGE_SEVERITY_POLICY: TriageSeverityPolicy = {
  statusWeights: {
    open: 45,
    assigned: 32,
    accepted: 24,
    enroute: 18,
  },
  waitWeightPerMinute: 0.35,
  waitMinutesCap: 240,
  unassignedBonus: 18,
  staleEventThresholdMinutes: 20,
  staleEventBonus: 10,
  bandThresholds: {
    critical: 85,
    high: 65,
    medium: 35,
  },
  locationPrecision: 2,
};

export type RawActiveRequestRow = {
  requestId: string;
  status: ActiveRequestStatus;
  assignedNurseUserId: string | null;
  createdAt: string;
  lastEventAt: string;
  lat: string;
  lng: string;
};

export type ActiveQueueItem = AdminActiveRequestQueueItem;

function elapsedMinutes(from: Date, to: Date) {
  const deltaMs = to.getTime() - from.getTime();
  return Math.max(0, Math.floor(deltaMs / 60_000));
}

export function mapSeverityBand(
  score: number,
  policy: TriageSeverityPolicy,
): RequestSeverityBand {
  if (score >= policy.bandThresholds.critical) {
    return "critical";
  }
  if (score >= policy.bandThresholds.high) {
    return "high";
  }
  if (score >= policy.bandThresholds.medium) {
    return "medium";
  }
  return "low";
}

export function toLocationHint(lat: string, lng: string, precision: number) {
  const safePrecision = Number.isInteger(precision) ? precision : 2;
  const latValue = Number(lat);
  const lngValue = Number(lng);

  if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) {
    return "masked";
  }

  return `~${latValue.toFixed(safePrecision)},${lngValue.toFixed(safePrecision)}`;
}

export function buildActiveQueueItem(
  row: RawActiveRequestRow,
  policy: TriageSeverityPolicy,
  now: Date,
): ActiveQueueItem {
  const createdAt = new Date(row.createdAt);
  const lastEventAt = new Date(row.lastEventAt);
  const waitMinutes = elapsedMinutes(createdAt, now);
  const staleEventMinutes = elapsedMinutes(lastEventAt, now);

  const weightedWait = Math.min(waitMinutes, policy.waitMinutesCap) * policy.waitWeightPerMinute;
  const assignedNurse = row.assignedNurseUserId ? "assigned" : "unassigned";

  let severityScore = policy.statusWeights[row.status] + weightedWait;
  if (assignedNurse === "unassigned") {
    severityScore += policy.unassignedBonus;
  }
  if (staleEventMinutes >= policy.staleEventThresholdMinutes) {
    severityScore += policy.staleEventBonus;
  }

  const normalizedScore = Math.round(severityScore);

  return {
    requestId: row.requestId,
    status: row.status,
    severityScore: normalizedScore,
    severityBand: mapSeverityBand(normalizedScore, policy),
    waitMinutes,
    lastEventAt: new Date(row.lastEventAt).toISOString(),
    createdAt: new Date(row.createdAt).toISOString(),
    assignedNurse,
    locationHint: toLocationHint(row.lat, row.lng, policy.locationPrecision),
  };
}

export function sortQueueItems(items: ActiveQueueItem[]) {
  return [...items].sort((a, b) => {
    if (a.severityScore !== b.severityScore) {
      return b.severityScore - a.severityScore;
    }
    if (a.waitMinutes !== b.waitMinutes) {
      return b.waitMinutes - a.waitMinutes;
    }

    const createdAtDelta =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }

    return a.requestId.localeCompare(b.requestId);
  });
}
