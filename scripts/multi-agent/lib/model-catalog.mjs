export const CODEX_MODELS = Object.freeze([
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
]);

export const DEFAULT_CODEX_MODEL = CODEX_MODELS[0];

export const CLAUDE_MODEL_ALIASES = Object.freeze({
  opus: "opus",
  sonnet: "sonnet",
  haiku: "haiku",
});

export const DEFAULT_CLAUDE_OPUS_MODEL = CLAUDE_MODEL_ALIASES.opus;
export const DEFAULT_CLAUDE_SONNET_MODEL = CLAUDE_MODEL_ALIASES.sonnet;
