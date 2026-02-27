import { z } from "zod";

const laneSchema = z.enum([
  "preflight-agent",
  "gatekeeper",
  "testing-agent",
  "compliance-agent",
  "verification-agent",
  "finalizer-agent",
]);

const isoDateSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "must be an ISO-8601 date string");

const internalRequestSchema = z.object({
  runId: z.string().min(1),
  taskId: z.string().min(1),
  mode: z.enum(["single", "multi"]),
  budgetUsd: z.number().nonnegative(),
  estimatedCostUsd: z.number().nonnegative(),
  lanes: z.array(laneSchema).min(1),
  metadata: z.record(z.string(), z.any()).default({}),
  createdAt: isoDateSchema,
});

const laneResultSchema = z.object({
  lane: laneSchema,
  status: z.enum(["pass", "fail", "skip"]),
  costUsd: z.number().nonnegative(),
  latencyMs: z.number().nonnegative(),
  notes: z.array(z.string()).default([]),
});

const internalResultSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(["pass", "fail"]),
  lanes: z.array(laneResultSchema).min(1),
  artifacts: z.record(z.string(), z.string()).default({}),
  finishedAt: isoDateSchema,
});

const requestEnvelopeSchema = z.object({
  protocol: z.literal("a2a/1.0"),
  kind: z.literal("nurseconnect.multiagent.request"),
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  timestamp: isoDateSchema,
  payload: internalRequestSchema,
});

const resultEnvelopeSchema = z.object({
  protocol: z.literal("a2a/1.0"),
  kind: z.literal("nurseconnect.multiagent.result"),
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  timestamp: isoDateSchema,
  payload: internalResultSchema,
});

function createEnvelopeBase(options = {}) {
  return {
    protocol: options.protocol || "a2a/1.0",
    source: options.source || "nurseconnect.multiagent",
    target: options.target || "a2a.partner",
    timestamp: options.timestamp || new Date().toISOString(),
    id: options.id || `a2a-${Date.now().toString(36)}`,
  };
}

function parseWithSchema(schema, value, label) {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");

  throw new Error(`${label} validation failed: ${issues}`);
}

export function exportRequestToA2A(internalRequest, options = {}) {
  const payload = parseWithSchema(internalRequestSchema, internalRequest, "Internal request");
  const envelope = {
    ...createEnvelopeBase(options),
    kind: options.requestKind || "nurseconnect.multiagent.request",
    payload,
  };

  return parseWithSchema(requestEnvelopeSchema, envelope, "A2A envelope");
}

export function importRequestFromA2A(envelope) {
  const parsed = parseWithSchema(requestEnvelopeSchema, envelope, "A2A envelope");
  return parsed.payload;
}

export function exportResultToA2A(internalResult, options = {}) {
  const payload = parseWithSchema(internalResultSchema, internalResult, "Internal result");
  const envelope = {
    ...createEnvelopeBase(options),
    kind: options.resultKind || "nurseconnect.multiagent.result",
    payload,
  };

  return parseWithSchema(resultEnvelopeSchema, envelope, "A2A envelope");
}

export function importResultFromA2A(envelope) {
  const parsed = parseWithSchema(resultEnvelopeSchema, envelope, "A2A envelope");
  return parsed.payload;
}

export function getA2ASchemas() {
  return {
    internalRequestSchema,
    internalResultSchema,
    requestEnvelopeSchema,
    resultEnvelopeSchema,
  };
}
