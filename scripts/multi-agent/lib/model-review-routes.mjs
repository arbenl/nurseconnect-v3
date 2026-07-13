import {
  CODEX_MODELS,
  DEFAULT_CLAUDE_OPUS_MODEL,
  DEFAULT_CLAUDE_SONNET_MODEL,
  DEFAULT_CODEX_MODEL,
} from "./model-catalog.mjs";

export const defaultReviewers = ["sonnet46", "gemini"];

function claudeRoute({ label, model, role, overrideEnv }) {
  return {
    label,
    provider: "claude",
    model,
    role,
    overrideEnv,
    command: "claude",
    args: ["-p", "{prompt}", "--model", model, "--tools", "", "--no-session-persistence"],
  };
}

export const routes = {
  codex: {
    label: "Codex implementation critique",
    provider: "codex",
    model: process.env.CODEX_REVIEW_MODEL || process.env.CODEX_MODEL || DEFAULT_CODEX_MODEL,
    role: "primary implementation critique",
    command: "codex",
    args: ["exec", "--model", process.env.CODEX_REVIEW_MODEL || process.env.CODEX_MODEL || DEFAULT_CODEX_MODEL, "{prompt}"],
  },
  claude48: claudeRoute({
    label: "Current Claude Opus enterprise architecture review",
    model: process.env.CLAUDE_48_REVIEW_MODEL || DEFAULT_CLAUDE_OPUS_MODEL,
    role: "strongest configured Claude review",
    overrideEnv: "CLAUDE_48_REVIEW_MODEL",
  }),
  claude47: claudeRoute({
    label: "Current Claude Sonnet fallback architecture review",
    model: process.env.CLAUDE_47_REVIEW_MODEL || DEFAULT_CLAUDE_SONNET_MODEL,
    role: "Claude fallback review",
    overrideEnv: "CLAUDE_47_REVIEW_MODEL",
  }),
  sonnet46: claudeRoute({
    label: "Current Claude Sonnet implementation review",
    model: process.env.CLAUDE_SONNET_46_REVIEW_MODEL || DEFAULT_CLAUDE_SONNET_MODEL,
    role: "Sonnet implementation fallback review",
    overrideEnv: "CLAUDE_SONNET_46_REVIEW_MODEL",
  }),
  claude: claudeRoute({
    label: "Current Claude Sonnet implementation review",
    model: process.env.CLAUDE_SONNET_46_REVIEW_MODEL || DEFAULT_CLAUDE_SONNET_MODEL,
    role: "Backward-compatible alias for sonnet46",
    overrideEnv: "CLAUDE_SONNET_46_REVIEW_MODEL",
  }),
  gemini: {
    label: "Gemini Pro product review",
    provider: "gemini",
    model: process.env.GEMINI_REVIEW_MODEL || "gemini-3.1-pro-preview",
    role: "product, UX, accessibility, and workflow critique",
    overrideEnv: "GEMINI_REVIEW_MODEL",
    command: "gemini",
    args: [
      "-p",
      "{prompt}",
      "--model",
      process.env.GEMINI_REVIEW_MODEL || "gemini-3.1-pro-preview",
      "--output-format",
      "text",
    ],
  },
  copilot: {
    label: "Copilot Pro+ Sonnet 4.6 review",
    provider: "copilot",
    model: process.env.COPILOT_REVIEW_MODEL || "claude-sonnet-4.6",
    role: "Copilot PR-review fallback",
    overrideEnv: "COPILOT_REVIEW_MODEL",
    command: "copilot",
    args: [
      "--model",
      process.env.COPILOT_REVIEW_MODEL || "claude-sonnet-4.6",
      "--effort",
      "low",
      "-p",
      "{prompt}",
      "--available-tools=",
      "--no-custom-instructions",
      "--no-color",
      "--silent",
      "--no-remote",
      "--no-ask-user",
      "--output-format",
      "text",
      "--stream",
      "off",
    ],
  },
};

export { CODEX_MODELS };

export function commandArgs(route, prompt) {
  return route.args.map((arg) => (arg === "{prompt}" ? prompt : arg));
}

export function splitReviewers(value, fail) {
  const selected = String(value || defaultReviewers.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  for (const reviewer of selected) {
    if (!routes[reviewer]) fail(`unknown reviewer route: ${reviewer}`);
  }
  return selected;
}
