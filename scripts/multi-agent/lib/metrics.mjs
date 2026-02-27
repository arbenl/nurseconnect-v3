function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sortedValues.length) - 1;
  const index = Math.max(0, Math.min(rank, sortedValues.length - 1));
  return sortedValues[index];
}

export function calculateMetricsFromEvents(events = []) {
  const laneEvents = events.filter((event) => event && event.type === "lane-complete");
  const laneCount = laneEvents.length;

  if (laneCount === 0) {
    return {
      successRate: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      totalCostUsd: 0,
      qualityPerDollar: 0,
      laneCount: 0,
    };
  }

  const successCount = laneEvents.filter((event) => event.status === "pass").length;
  const latencyValues = laneEvents
    .map((event) => Number(event.durationMs || 0))
    .filter((value) => Number.isFinite(value));
  const totalLatency = latencyValues.reduce((acc, current) => acc + current, 0);
  const sortedLatency = [...latencyValues].sort((left, right) => left - right);
  const totalCostUsd = laneEvents
    .map((event) => Number(event.costUsd || 0))
    .filter((value) => Number.isFinite(value))
    .reduce((acc, current) => acc + current, 0);

  const successRate = successCount / laneCount;
  const avgLatencyMs = totalLatency / laneCount;
  const p95LatencyMs = percentile(sortedLatency, 95);
  const qualityPerDollar = totalCostUsd > 0 ? successRate / totalCostUsd : 0;

  return {
    successRate,
    avgLatencyMs,
    p95LatencyMs,
    totalCostUsd,
    qualityPerDollar,
    laneCount,
  };
}
