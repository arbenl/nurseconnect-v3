import { describe, expect, it } from "vitest";

import {
  CODEX_MODELS,
  DEFAULT_OPENAI_MODEL,
  resolveFallbackProviderModel,
  resolveRequestedProviderModel,
} from "../agent-runner-models.mjs";

describe("agent runner model resolution", () => {
  it("exposes the installed Codex 5.6 lineup", () => {
    expect(CODEX_MODELS).toEqual(["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"]);
  });

  it("defaults requested Codex/OpenAI runs to GPT-5.6 Sol", () => {
    expect(resolveRequestedProviderModel("codex", {})).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveRequestedProviderModel("openai", {})).toBe(DEFAULT_OPENAI_MODEL);
  });

  it("preserves shared explicit overrides for every provider", () => {
    expect(resolveRequestedProviderModel("codex", { STEER_MODEL: "shared-model" })).toBe(
      "shared-model"
    );
    expect(resolveFallbackProviderModel("gemini", { AGENT_MODEL: "agent-model" })).toBe(
      "agent-model"
    );
  });

  it("keeps Gemini fallback from inheriting the OpenAI default or Codex-only model", () => {
    expect(resolveFallbackProviderModel("gemini", {})).toBeUndefined();
    expect(resolveFallbackProviderModel("gemini", { CODEX_MODEL: "codex-only" })).toBeUndefined();
    expect(resolveFallbackProviderModel("gemini", { GEMINI_MODEL: "gemini-pro" })).toBe(
      "gemini-pro"
    );
  });

  it("keeps provider-specific requested models isolated unless a shared override is set", () => {
    expect(resolveRequestedProviderModel("gemini", { CODEX_MODEL: "gpt-5.6-terra" })).toBeUndefined();
    expect(resolveRequestedProviderModel("codex", { GEMINI_MODEL: "gemini-pro" })).toBe(DEFAULT_OPENAI_MODEL);
    expect(resolveRequestedProviderModel("gemini", { STEER_MODEL: "shared-model" })).toBe(
      "shared-model"
    );
  });
});
