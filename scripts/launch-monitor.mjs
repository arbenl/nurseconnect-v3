#!/usr/bin/env node

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_ITERATIONS = 12;
const DEFAULT_TIMEOUT_MS = 10_000;

function parseArgs(argv) {
  const options = {
    baseUrl: process.env.LAUNCH_MONITOR_URL || process.env.APP_URL || "http://localhost:3000",
    intervalMs: DEFAULT_INTERVAL_MS,
    iterations: DEFAULT_ITERATIONS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    adminCookie: process.env.LAUNCH_MONITOR_ADMIN_COOKIE || "",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--once") {
      options.iterations = 1;
    } else if (arg === "--url") {
      options.baseUrl = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--url=")) {
      options.baseUrl = arg.slice("--url=".length);
    } else if (arg === "--interval-ms") {
      options.intervalMs = parsePositiveInteger(arg, requireValue(arg, next));
      i += 1;
    } else if (arg.startsWith("--interval-ms=")) {
      options.intervalMs = parsePositiveInteger(arg, arg.slice("--interval-ms=".length));
    } else if (arg === "--iterations") {
      options.iterations = parsePositiveInteger(arg, requireValue(arg, next));
      i += 1;
    } else if (arg.startsWith("--iterations=")) {
      options.iterations = parsePositiveInteger(arg, arg.slice("--iterations=".length));
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(arg, requireValue(arg, next));
      i += 1;
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = parsePositiveInteger(arg, arg.slice("--timeout-ms=".length));
    } else if (arg === "--admin-cookie") {
      options.adminCookie = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--admin-cookie=")) {
      options.adminCookie = arg.slice("--admin-cookie=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.baseUrl = normalizeBaseUrl(options.baseUrl);
  return options;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInteger(flag, value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function normalizeBaseUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Launch monitor URL cannot be empty");
  }
  return trimmed.replace(/\/+$/, "");
}

function printHelp() {
  console.log(`NurseConnect launch monitor

Usage:
  pnpm launch:monitor -- --url https://production.example.com
  pnpm launch:monitor -- --url https://production.example.com --once --json

Options:
  --url <url>             Base app URL. Defaults to LAUNCH_MONITOR_URL, APP_URL, or http://localhost:3000.
  --once                  Run one sample instead of the default first-hour loop.
  --iterations <n>        Number of samples. Default: ${DEFAULT_ITERATIONS}.
  --interval-ms <n>       Delay between samples. Default: ${DEFAULT_INTERVAL_MS}.
  --timeout-ms <n>        HTTP timeout per request. Default: ${DEFAULT_TIMEOUT_MS}.
  --json                  Print final structured JSON instead of human-readable logs.
  --admin-cookie <value>  Optional Cookie header for /api/admin/ops/status.

Environment:
  LAUNCH_MONITOR_URL
  APP_URL
  LAUNCH_MONITOR_ADMIN_COOKIE
`);
}

function endpoint(baseUrl, path) {
  return `${baseUrl}${path}`;
}

async function fetchJson(url, { timeoutMs, headers = {} }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { parseError: "Response was not valid JSON", raw: text.slice(0, 500) };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateHealth(result) {
  const failures = [];
  const warnings = [];
  const body = result.body;

  if (!result.ok) {
    failures.push(`health returned HTTP ${result.status}`);
  }
  if (!body || typeof body !== "object") {
    failures.push("health response body is missing or invalid");
    return { failures, warnings };
  }
  if (body.ok !== true) {
    failures.push("health ok is not true");
  }
  if (body.db !== "ok") {
    failures.push("health db is not ok");
  }
  if (Number(body.serviceAreas?.active ?? 0) <= 0) {
    failures.push("active service areas is 0");
  }
  if (Number(body.nurseSupply?.verifiedAndAvailable ?? 0) <= 0) {
    failures.push("verified and available nurse supply is 0");
  }

  return { failures, warnings };
}

function evaluateOpsStatus(result) {
  const failures = [];
  const warnings = [];
  const body = result.body;

  if (!result.ok) {
    failures.push(`ops status returned HTTP ${result.status}`);
  }
  if (!body || typeof body !== "object") {
    failures.push("ops status response body is missing or invalid");
    return { failures, warnings };
  }
  if (body.db !== "ok") {
    failures.push("ops status db is not ok");
  }
  if (Number(body.serviceAreas?.active ?? 0) <= 0) {
    failures.push("ops status active service areas is 0");
  }
  if (Number(body.nurseSupply?.verifiedAndAvailable ?? 0) <= 0) {
    failures.push("ops status verified and available nurse supply is 0");
  }
  if (Number(body.requests?.unassigned ?? 0) >= 3) {
    failures.push("unassigned requests is 3 or more");
  }
  if (Number(body.requests?.staleEnroute ?? 0) > 0) {
    failures.push("stale enroute requests exist");
  }
  if (Number(body.requests?.exceptionQueue ?? 0) >= 5) {
    failures.push("exception queue is 5 or more");
  }
  if (Number(body.payments?.recentFailedAuthorizations ?? 0) > 0) {
    failures.push("recent failed payment authorizations exist");
  }
  if (Number(body.payments?.recentFailedPayouts ?? 0) > 0) {
    failures.push("recent failed payouts exist");
  }
  if (Number(body.requests?.staleAssigned ?? 0) > 0) {
    warnings.push("stale assigned requests exist");
  }
  if (Number(body.payments?.authorizationsWithoutPayout ?? 0) > 0) {
    warnings.push("payment authorizations without payout exist");
  }

  return { failures, warnings };
}

async function collectSample(options, index) {
  const startedAt = new Date().toISOString();
  const health = await fetchJson(endpoint(options.baseUrl, "/api/health"), {
    timeoutMs: options.timeoutMs,
  });
  const healthEvaluation = evaluateHealth(health);
  let opsStatus = null;
  let opsEvaluation = { failures: [], warnings: [] };

  if (options.adminCookie.trim()) {
    opsStatus = await fetchJson(endpoint(options.baseUrl, "/api/admin/ops/status"), {
      timeoutMs: options.timeoutMs,
      headers: {
        cookie: options.adminCookie,
      },
    });
    opsEvaluation = evaluateOpsStatus(opsStatus);
  }

  const failures = [
    ...healthEvaluation.failures.map((message) => `health: ${message}`),
    ...opsEvaluation.failures.map((message) => `ops: ${message}`),
  ];
  const warnings = [
    ...healthEvaluation.warnings.map((message) => `health: ${message}`),
    ...opsEvaluation.warnings.map((message) => `ops: ${message}`),
  ];

  return {
    index,
    startedAt,
    ok: failures.length === 0,
    failures,
    warnings,
    health,
    opsStatus,
  };
}

function printSample(sample, total) {
  const status = sample.ok ? "PASS" : "FAIL";
  console.log(`[${sample.index}/${total}] ${status} ${sample.startedAt}`);
  printHealthSummary(sample.health);
  if (sample.opsStatus) {
    printOpsSummary(sample.opsStatus);
  } else {
    console.log("  ops: skipped; set LAUNCH_MONITOR_ADMIN_COOKIE or --admin-cookie to poll admin ops status");
  }

  for (const warning of sample.warnings) {
    console.log(`  WARN ${warning}`);
  }
  for (const failure of sample.failures) {
    console.log(`  FAIL ${failure}`);
  }
}

function printHealthSummary(result) {
  const body = result.body || {};
  console.log(
    [
      `  health: HTTP ${result.status}`,
      `ok=${String(body.ok)}`,
      `db=${String(body.db)}`,
      `activeAreas=${String(body.serviceAreas?.active ?? "n/a")}`,
      `verifiedAvailable=${String(body.nurseSupply?.verifiedAndAvailable ?? "n/a")}`,
    ].join(" "),
  );
}

function printOpsSummary(result) {
  const body = result.body || {};
  console.log(
    [
      `  ops: HTTP ${result.status}`,
      `db=${String(body.db)}`,
      `activeAreas=${String(body.serviceAreas?.active ?? "n/a")}`,
      `verifiedAvailable=${String(body.nurseSupply?.verifiedAndAvailable ?? "n/a")}`,
      `unassigned=${String(body.requests?.unassigned ?? "n/a")}`,
      `staleAssigned=${String(body.requests?.staleAssigned ?? "n/a")}`,
      `staleEnroute=${String(body.requests?.staleEnroute ?? "n/a")}`,
      `exceptions=${String(body.requests?.exceptionQueue ?? "n/a")}`,
      `authWithoutPayout=${String(body.payments?.authorizationsWithoutPayout ?? "n/a")}`,
      `failedAuth=${String(body.payments?.recentFailedAuthorizations ?? "n/a")}`,
      `failedPayout=${String(body.payments?.recentFailedPayouts ?? "n/a")}`,
    ].join(" "),
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(2);
  }

  if (options.help) {
    printHelp();
    return;
  }

  const samples = [];
  const failures = [];
  const warnings = [];
  const generatedAt = new Date().toISOString();

  if (!options.json) {
    console.log("NurseConnect first-hour launch monitor");
    console.log(`Target: ${options.baseUrl}`);
    console.log(`Samples: ${options.iterations}`);
    console.log(`Interval: ${options.intervalMs}ms`);
    console.log("");
  }

  for (let index = 1; index <= options.iterations; index += 1) {
    let sample;
    try {
      sample = await collectSample(options, index);
    } catch (error) {
      sample = {
        index,
        startedAt: new Date().toISOString(),
        ok: false,
        failures: [error instanceof Error ? error.message : String(error)],
        warnings: [],
        health: { ok: false, status: 0, body: null },
        opsStatus: null,
      };
    }

    samples.push(sample);
    failures.push(...sample.failures.map((message) => `sample ${index}: ${message}`));
    warnings.push(...sample.warnings.map((message) => `sample ${index}: ${message}`));

    if (!options.json) {
      printSample(sample, options.iterations);
      console.log("");
    }

    if (index < options.iterations) {
      await sleep(options.intervalMs);
    }
  }

  const result = {
    ok: failures.length === 0,
    generatedAt,
    target: options.baseUrl,
    iterations: options.iterations,
    intervalMs: options.intervalMs,
    timeoutMs: options.timeoutMs,
    opsStatusPolled: Boolean(options.adminCookie.trim()),
    failures,
    warnings,
    samples,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log("Launch monitor checks passed.");
  } else {
    console.error(`Launch monitor failed: ${failures.length} failure(s).`);
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
