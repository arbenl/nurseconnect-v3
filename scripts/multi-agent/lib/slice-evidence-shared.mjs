import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export function resolveRepoPath(repoRoot, value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export function pass(message, details = {}) {
  return { status: "pass", message, ...details };
}

export function fail(message, details = {}) {
  return { status: "fail", message, ...details };
}

export function checkFile(label, file) {
  return existsSync(file) ? pass(`${label} exists`, { path: file }) : fail(`${label} is missing`, { path: file });
}

export function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function missingRequired(actual, required) {
  const actualSet = new Set(actual);
  return required.filter((item) => !actualSet.has(item));
}

export function validMustFixDisposition(value, count) {
  const normalized = String(value || "").trim().toLowerCase();
  if (count === 0) return normalized === "" || normalized === "none";
  return normalized === "all fixed" || /^rejected\s*:\s*\S.+/.test(normalized);
}
