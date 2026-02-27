import fs from "node:fs";
import path from "node:path";

import { discoverRepoRoot } from "./repo-root.mjs";

const DEFAULT_CONFIG_RELATIVE_PATH = path.join("config", "multi-agent.config.json");

function resolveConfigPath(repoRoot, requestedPath) {
  if (!requestedPath) {
    return path.join(repoRoot, DEFAULT_CONFIG_RELATIVE_PATH);
  }

  if (path.isAbsolute(requestedPath)) {
    return requestedPath;
  }

  return path.resolve(repoRoot, requestedPath);
}

export function loadMultiAgentConfig(options = {}) {
  const probeCwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const discoveredRepoRoot = discoverRepoRoot(probeCwd);
  const configPath = resolveConfigPath(discoveredRepoRoot, options.configPath);

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Missing multi-agent config at ${configPath}. Create config/multi-agent.config.json or pass --config <path>.`
    );
  }

  const rawConfig = fs.readFileSync(configPath, "utf8");
  const parsedConfig = JSON.parse(rawConfig);

  const resolvedRepoRoot =
    typeof parsedConfig.repoRoot === "string" && parsedConfig.repoRoot !== "auto"
      ? path.resolve(discoveredRepoRoot, parsedConfig.repoRoot)
      : discoveredRepoRoot;

  return {
    repoRoot: resolvedRepoRoot,
    configPath,
    config: parsedConfig,
  };
}

export function resolveRepoPath(repoRoot, maybeRelativePath) {
  if (!maybeRelativePath) {
    return repoRoot;
  }
  if (path.isAbsolute(maybeRelativePath)) {
    return maybeRelativePath;
  }
  return path.join(repoRoot, maybeRelativePath);
}

export function resolveConfiguredPath(repoRoot, configuredPath, fallbackRelativePath) {
  const chosen = configuredPath || fallbackRelativePath;
  return resolveRepoPath(repoRoot, chosen);
}
