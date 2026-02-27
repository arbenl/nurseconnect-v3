import fs from "node:fs";
import path from "node:path";

export function ensureDir(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function appendText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, text, "utf8");
}

export function appendNdjson(filePath, record) {
  appendText(filePath, `${JSON.stringify(record)}\n`);
}

export function readNdjson(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const raw = fs.readFileSync(filePath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function listSubdirectories(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return [];
  }

  return fs
    .readdirSync(rootPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootPath, entry.name));
}

export function getLatestDirectory(rootPath) {
  const directories = listSubdirectories(rootPath);
  if (directories.length === 0) {
    return null;
  }

  const withMtime = directories.map((directoryPath) => {
    const stats = fs.statSync(directoryPath);
    return { directoryPath, mtimeMs: stats.mtimeMs };
  });

  withMtime.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return withMtime[0].directoryPath;
}
