#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 10_000;
const SESSION_COOKIE_PATTERN = /(?:^|,\s*)((?:__Secure-)?better-auth\.session_token=[^;,\s]+)/;

export function parseArgs(argv, env = process.env) {
  const options = {
    baseUrl: env.LAUNCH_AUTH_MONITOR_URL || env.LAUNCH_MONITOR_URL || env.APP_URL || "http://localhost:3010",
    email: env.LAUNCH_AUTH_MONITOR_EMAIL || "",
    password: env.LAUNCH_AUTH_MONITOR_PASSWORD || "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    json: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--") {
      continue;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--url") {
      options.baseUrl = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--url=")) {
      options.baseUrl = arg.slice("--url=".length);
    } else if (arg === "--email") {
      options.email = requireValue(arg, next);
      i += 1;
    } else if (arg.startsWith("--email=")) {
      options.email = arg.slice("--email=".length);
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(arg, requireValue(arg, next));
      i += 1;
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = parsePositiveInteger(arg, arg.slice("--timeout-ms=".length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.help) {
    return options;
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
    throw new Error("Auth monitor URL cannot be empty");
  }
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Auth monitor URL must be a valid absolute URL");
  }

  const isLocalhost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]" ||
    url.hostname === "::1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost)) {
    throw new Error("Auth monitor URL must use HTTPS except for localhost development targets");
  }

  return url.toString().replace(/\/+$/, "");
}

export function printHelp() {
  console.log(`NurseConnect auth/session monitor

Usage:
  pnpm launch:auth-monitor -- --url https://production.example.com
  pnpm launch:auth-monitor -- --url https://production.example.com --json

Options:
  --url <url>             Base app URL. Defaults to LAUNCH_AUTH_MONITOR_URL, LAUNCH_MONITOR_URL, APP_URL, or http://localhost:3010.
  --email <email>         Synthetic admin email. Defaults to LAUNCH_AUTH_MONITOR_EMAIL.
  --timeout-ms <n>        HTTP timeout per request. Default: ${DEFAULT_TIMEOUT_MS}.
  --json                  Print structured JSON instead of human-readable logs.

Environment:
  LAUNCH_AUTH_MONITOR_URL
  LAUNCH_AUTH_MONITOR_EMAIL
  LAUNCH_AUTH_MONITOR_PASSWORD
`);
}

function endpoint(baseUrl, path) {
  return `${baseUrl}${path}`;
}

async function fetchJson(url, { timeoutMs, method = "GET", headers = {}, body } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...headers,
      },
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed = null;

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { parseError: "Response was not valid JSON" };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      body: parsed,
      setCookieHeaders: getSetCookieHeaders(response.headers),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }
  const header = headers.get("set-cookie");
  return header ? [header] : [];
}

export function extractSessionCookie(setCookieHeaders) {
  for (const header of setCookieHeaders) {
    const match = header.match(SESSION_COOKIE_PATTERN);
    if (match?.[1]) {
      return match[1];
    }
  }
  return "";
}

function publicStep(name, result, details = {}) {
  return {
    name,
    ok: result.ok,
    status: result.status,
    ...details,
  };
}

export async function runAuthMonitor(options) {
  const generatedAt = new Date().toISOString();
  const failures = [];
  const warnings = [];
  const steps = [];

  if (!options.email.trim()) {
    failures.push("synthetic admin email is missing");
  }
  if (!options.password.trim()) {
    failures.push("synthetic admin password is missing");
  }
  if (failures.length > 0) {
    return buildResult({ options, generatedAt, failures, warnings, steps });
  }

  const signIn = await fetchJson(endpoint(options.baseUrl, "/api/auth/sign-in/email"), {
    timeoutMs: options.timeoutMs,
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: options.baseUrl,
    },
    body: JSON.stringify({
      email: options.email,
      password: options.password,
    }),
  });
  const sessionCookie = extractSessionCookie(signIn.setCookieHeaders);
  steps.push(publicStep("sign-in", signIn, { sessionCookie: sessionCookie ? "present" : "missing" }));

  if (!signIn.ok) {
    failures.push(`sign-in returned HTTP ${signIn.status}`);
  }
  if (!sessionCookie) {
    failures.push("sign-in did not return a Better Auth session cookie");
  }
  if (failures.length > 0) {
    return buildResult({ options, generatedAt, failures, warnings, steps });
  }

  const authHeaders = {
    cookie: sessionCookie,
  };
  const me = await fetchJson(endpoint(options.baseUrl, "/api/me"), {
    timeoutMs: options.timeoutMs,
    headers: authHeaders,
  });
  const meRole = typeof me.body?.user?.role === "string" ? me.body.user.role : null;
  steps.push(publicStep("/api/me", me, { role: meRole ?? "missing" }));

  if (!me.ok) {
    failures.push(`/api/me returned HTTP ${me.status}`);
  }
  if (!me.body?.user) {
    failures.push("/api/me did not return an authenticated user");
  } else if (meRole !== "admin") {
    failures.push(`/api/me user role is ${String(meRole)}, expected admin`);
  }

  const adminPing = await fetchJson(endpoint(options.baseUrl, "/api/admin/ping"), {
    timeoutMs: options.timeoutMs,
    headers: authHeaders,
  });
  const adminRole = typeof adminPing.body?.user?.role === "string" ? adminPing.body.user.role : null;
  steps.push(publicStep("/api/admin/ping", adminPing, { role: adminRole ?? "missing" }));

  if (!adminPing.ok) {
    failures.push(`/api/admin/ping returned HTTP ${adminPing.status}`);
  }
  if (adminRole !== "admin") {
    failures.push(`/api/admin/ping user role is ${String(adminRole)}, expected admin`);
  }

  const signOut = await fetchJson(endpoint(options.baseUrl, "/api/auth/sign-out"), {
    timeoutMs: options.timeoutMs,
    method: "POST",
    headers: {
      ...authHeaders,
      origin: options.baseUrl,
    },
  });
  steps.push(publicStep("sign-out", signOut));
  if (!signOut.ok) {
    warnings.push(`sign-out returned HTTP ${signOut.status}; rotate or expire the synthetic session manually`);
  }

  return buildResult({ options, generatedAt, failures, warnings, steps });
}

function buildResult({ options, generatedAt, failures, warnings, steps }) {
  return {
    ok: failures.length === 0,
    generatedAt,
    target: options.baseUrl,
    timeoutMs: options.timeoutMs,
    failures,
    warnings,
    steps,
  };
}

export function renderHuman(result) {
  const lines = [
    "NurseConnect auth/session monitor",
    `Target: ${result.target}`,
  ];

  for (const step of result.steps) {
    const status = step.ok ? "PASS" : "FAIL";
    const details = [];
    if (typeof step.status !== "undefined") {
      details.push(`HTTP ${step.status}`);
    }
    if (step.sessionCookie) {
      details.push(`sessionCookie=${step.sessionCookie}`);
    }
    if (step.role) {
      details.push(`role=${step.role}`);
    }
    lines.push(`${status} ${step.name}${details.length > 0 ? ` ${details.join(" ")}` : ""}`);
  }

  for (const warning of result.warnings) {
    lines.push(`WARN ${warning}`);
  }
  for (const failure of result.failures) {
    lines.push(`FAIL ${failure}`);
  }

  lines.push(result.ok ? "Auth/session monitor checks passed." : "Auth/session monitor failed.");
  return lines.join("\n");
}

export function renderJson(result) {
  return JSON.stringify(result, null, 2);
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

  let result;
  try {
    result = await runAuthMonitor(options);
  } catch (error) {
    result = {
      ok: false,
      generatedAt: new Date().toISOString(),
      target: options.baseUrl,
      timeoutMs: options.timeoutMs,
      failures: [error instanceof Error ? error.message : String(error)],
      warnings: [],
      steps: [],
    };
  }

  if (options.json) {
    console.log(renderJson(result));
  } else {
    const output = renderHuman(result);
    if (result.ok) {
      console.log(output);
    } else {
      console.error(output);
    }
  }

  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exit(1);
  });
}
