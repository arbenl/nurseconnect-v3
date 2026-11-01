import { isDeepStrictEqual } from "node:util";
const text = { type: "string" }, number = { type: "number" };
const object = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const SENIOR_REVIEW_SCHEMA = object({
  findings: { type: "array", items: object({
    title: text, body: text, confidence_score: number,
    priority: { type: "integer", enum: [0, 1, 2, 3] },
    code_location: object({ absolute_file_path: text,
      line_range: object({ start: { type: "integer" }, end: { type: "integer" } }),
    }),
  }) },
  overall_correctness: { type: "string", enum: ["patch is correct", "patch is incorrect"] },
  overall_explanation: text, overall_confidence_score: number,
});
const keys = (value, expected) => value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const confidence = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
function validReview(review) {
  if (!keys(review, ["findings", "overall_correctness", "overall_explanation", "overall_confidence_score"])
    || !Array.isArray(review.findings) || !["patch is correct", "patch is incorrect"].includes(review.overall_correctness)
    || typeof review.overall_explanation !== "string" || !confidence(review.overall_confidence_score)) return false;
  if (review.overall_correctness === "patch is incorrect" && !review.findings.length) return false;
  return review.findings.every((finding) => {
    if (!keys(finding, ["title", "body", "confidence_score", "priority", "code_location"])
      || !Number.isInteger(finding.priority) || finding.priority < 0 || finding.priority > 3
      || typeof finding.title !== "string" || !finding.title.startsWith(`[P${finding.priority}]`)
      || typeof finding.body !== "string" || !finding.body.trim() || !confidence(finding.confidence_score)) return false;
    const location = finding.code_location, range = location?.line_range;
    return keys(location, ["absolute_file_path", "line_range"]) && typeof location.absolute_file_path === "string"
      && keys(range, ["start", "end"]) && Number.isInteger(range.start) && range.start > 0
      && Number.isInteger(range.end) && range.end >= range.start;
  });
}
function providerFailure(text) {
  if (/quota|rate limit|too many requests|429/i.test(text)) return "quota_or_rate_limit";
  if (/auth|unauthorized|forbidden|login|api key|token/i.test(text)) return "auth";
  return "command_failed";
}
export function inspectSeniorResult(result) {
  const blocked = (blocker) => ({ blocker, mustFixCount: 0, review: null, runtimeComplete: false });
  if (result.timedOut === "first_output") return blocked("no_output_timeout");
  if (result.timedOut === "total") return blocked("total_timeout");
  if (result.status !== 0 || result.signal) return blocked(providerFailure(`${result.stdout}\n${result.stderr}`));
  if (!String(result.stdout || "").trim() || !result.finalMessage) return blocked("no_review_output");
  let events, review;
  try {
    events = result.stdout.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
    review = JSON.parse(result.finalMessage);
  } catch { return blocked("invalid_review_protocol"); }
  const failure = events.find((event) => event?.type === "error" || event?.type === "turn.failed");
  if (failure) return blocked(providerFailure(JSON.stringify(failure)));
  if (events.at(-1)?.type !== "turn.completed") return blocked("incomplete_review");
  const messages = events.filter((event) => event?.type === "item.completed" && event.item?.type === "agent_message");
  if (!messages.length || !validReview(review)) return blocked("invalid_structured_review");
  try {
    if (!isDeepStrictEqual(JSON.parse(messages.at(-1).item.text), review)) return blocked("review_channel_mismatch");
  } catch { return blocked("invalid_structured_review"); }
  return { blocker: "", review, runtimeComplete: true,
    mustFixCount: review.findings.filter((finding) => finding.priority <= 1 || /\bMUST_FIX\b/.test(finding.title + " " + finding.body)).length };
}
