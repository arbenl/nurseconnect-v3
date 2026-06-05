export const MODULARITY_LINE_LIMIT = 150;

export const CHECKED_TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".js",
  ".jsx",
  ".md",
  ".json",
  ".jsonl",
  ".mjs",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const EXCLUDED_EXACT_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

const EXCLUDED_PREFIXES = [
  ".next/",
  "apps/web/.next/",
  "apps/web/playwright-report/",
  "apps/web/test-results/",
  "build/",
  "coverage/",
  "dist/",
  "node_modules/",
  "packages/database/drizzle/",
  "tmp/",
];

const EXCLUDED_SEGMENTS = new Set([
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "tmp",
]);

export function toPolicyPath(filePath) {
  return String(filePath || "").replaceAll("\\", "/").replace(/^\/+/, "");
}

export function isCheckedTextFile(filePath) {
  const relPath = toPolicyPath(filePath);
  if (relPath.endsWith(".d.ts")) return false;
  const extension = `.${relPath.split(".").pop()}`;
  return CHECKED_TEXT_EXTENSIONS.has(extension);
}

export function isExplicitModularityException(filePath) {
  const relPath = toPolicyPath(filePath);
  if (EXCLUDED_EXACT_FILES.has(relPath)) return true;
  if (EXCLUDED_PREFIXES.some((prefix) => relPath.startsWith(prefix))) return true;
  return relPath.split("/").some((segment) => EXCLUDED_SEGMENTS.has(segment));
}

export function isModularityChecked(filePath) {
  return isCheckedTextFile(filePath) && !isExplicitModularityException(filePath);
}
