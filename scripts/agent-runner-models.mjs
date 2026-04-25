export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

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
