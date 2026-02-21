type LogLevel = "info" | "warn" | "error";

type ApiActor = {
  id?: string | null;
  role?: string | null;
};

export type ApiLogContext = {
  requestId: string;
  route: string;
  method: string;
  action: string;
  actorId?: string;
  actorRole?: string;
};

type ClientErrorContext = {
  requestId?: string;
  route?: string;
  action?: string;
  actorId?: string;
  actorRole?: string;
};

function sanitizeRequestId(candidate: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^[A-Za-z0-9._-]{8,128}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function generateRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAction(route: string, fallback = "api.action") {
  if (!route) {
    return fallback;
  }

  const last = route.split("/").filter(Boolean).pop();
  if (!last) {
    return fallback;
  }

  if (last.startsWith("[") && last.endsWith("]")) {
    return `${route
      .split("/")
      .filter(Boolean)
      .slice(0, -1)
      .pop() ?? "api"}.${fallback}`;
  }

  return `${route}.${last}`;
}

export function getRequestId(headers: Headers): string {
  const headerRequestId = sanitizeRequestId(headers.get("x-request-id"));
  if (headerRequestId) {
    return headerRequestId;
  }

  return generateRequestId();
}

export function createApiLogContext(
  req: Pick<Request, "method" | "headers">,
  route: string,
  options: { action?: string; actor?: ApiActor } = {},
): ApiLogContext {
  const method = req.method ?? "GET";
  const requestId = getRequestId(req.headers);
  const action =
    options.action ??
    normalizeAction(route, "request");

  return {
    requestId,
    route,
    method,
    action,
    actorId: options.actor?.id ?? undefined,
    actorRole: options.actor?.role ?? undefined,
  };
}

function scrub(details: unknown) {
  if (details === null || details === undefined) {
    return details;
  }

  if (details instanceof Error) {
    return { name: details.name, message: details.message };
  }

  if (typeof details === "string") {
    return details.slice(0, 512);
  }

  if (typeof details === "number" || typeof details === "boolean") {
    return details;
  }

  if (Array.isArray(details)) {
    return details.slice(0, 10);
  }

  return "[redacted-object]";
}

function emit(level: LogLevel, event: string, context: ApiLogContext, details?: Record<string, unknown>) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context,
    details,
  };

  const payload = JSON.stringify({
    ...entry,
    details: details ? Object.fromEntries(Object.entries(details).map(([k, v]) => [k, scrub(v)])) : details,
  });
  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

export function logApiStart(context: ApiLogContext, startedAt: number) {
  const durationMs = Date.now() - startedAt;
  emit("info", "api.request.start", context, { durationMs });
}

export function logApiSuccess(context: ApiLogContext, status: number, startedAt: number, details: Record<string, unknown> = {}) {
  const durationMs = Date.now() - startedAt;
  emit("info", "api.request.success", context, { status, durationMs, ...details });
}

export function logApiFailure(
  context: ApiLogContext,
  error: unknown,
  status: number,
  startedAt: number,
  details: Record<string, unknown> = {},
) {
  const durationMs = Date.now() - startedAt;
  emit("error", "api.request.failure", context, {
    status,
    durationMs,
    error,
    ...details,
  });
}

export function withRequestId(response: Response, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export function logClientError(
  error: unknown,
  context: ClientErrorContext = {},
  details: Record<string, unknown> = {},
) {
  const payload = {
    level: "error",
    event: "ui.request.error",
    timestamp: new Date().toISOString(),
    requestId: context.requestId ?? generateRequestId(),
    ...context,
    details: details || {},
    error: scrub(error),
  };

  console.error(JSON.stringify(payload));
}
