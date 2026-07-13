import { CODEX_MODELS, DEFAULT_CODEX_MODEL } from "./multi-agent/lib/model-catalog.mjs";

export { CODEX_MODELS };
export const DEFAULT_OPENAI_MODEL = DEFAULT_CODEX_MODEL;

export function resolveRequestedProviderModel(provider, env = process.env) {
  const sharedModel = env.STEER_MODEL || env.AGENT_MODEL;
  if (sharedModel) {
    return sharedModel;
  }
  if (provider === "codex" || provider === "openai") {
    return env.CODEX_MODEL || DEFAULT_OPENAI_MODEL;
  }
  if (provider === "gemini" || provider === "google") {
    return env.GEMINI_MODEL;
  }
  return undefined;
}

export function resolveFallbackProviderModel(provider, env = process.env) {
  const sharedModel = env.STEER_MODEL || env.AGENT_MODEL;
  if (sharedModel) {
    return sharedModel;
  }
  if (provider === "gemini" || provider === "google") {
    return env.GEMINI_MODEL;
  }
  if (provider === "codex" || provider === "openai") {
    return env.CODEX_MODEL || DEFAULT_OPENAI_MODEL;
  }
  return undefined;
}
