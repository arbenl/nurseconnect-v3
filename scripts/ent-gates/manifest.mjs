import { existsSync, readFileSync } from "node:fs";

export const GATES = ["ent-tm", "ent-dlv", "ent-perf"];

const REQUIRED_HEADINGS = {
  "ent-tm": ["## Slice", "## Scope", "## Assets", "## Trust Boundaries", "## STRIDE Findings", "## Residual Risk", "## Verification"],
  "ent-dlv": ["## Scope", "## Verification"],
  "ent-perf": ["## Scope", "## Verification"],
};

export function loadManifest(file = "slice-gates.yaml") {
  if (!existsSync(file)) return { manifest: { gates: {} }, errors: [`Missing gate manifest: ${file}`] };
  return parseManifest(readFileSync(file, "utf8"));
}

export function parseManifest(source) {
  const manifest = { gates: {} };
  const errors = [];
  const seenTop = new Set();
  let currentGate = "";

  for (const raw of normalizeBlockScalars(source).split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (!line.trim()) continue;
    if (line.trim().startsWith("#")) continue;
    const top = line.match(/^([A-Za-z-]+):\s*(.*)$/);
    const gate = line.match(/^  ([A-Za-z-]+):\s*(.*)$/);
    const field = line.match(/^    ([A-Za-z-]+):\s*(.*)$/);

    if (top) {
      currentGate = "";
      const [, key, value] = top;
      if (seenTop.has(key)) errors.push(`Duplicate manifest key: ${key}`); else seenTop.add(key);
      if (["slice", "branch", "promotion-mode", "authority-files"].includes(key)) manifest[key] = clean(value);
      else if (key !== "gates") errors.push(`Unknown manifest key: ${key}`);
    } else if (gate) {
      currentGate = gate[1];
      if (Object.hasOwn(manifest.gates, currentGate)) errors.push(`Duplicate gate: ${currentGate}`);
      const inline = parseInlineMap(gate[2]);
      manifest.gates[currentGate] = inline || {};
      if (gate[2] && !inline) errors.push(`Unsupported inline gate map: ${raw.trim()}`);
      if (inline) currentGate = "";
    } else if (field && currentGate) {
      if (Object.hasOwn(manifest.gates[currentGate], field[1])) errors.push(`Duplicate ${currentGate} key: ${field[1]}`);
      manifest.gates[currentGate][field[1]] = clean(field[2]);
    } else {
      errors.push(`Unsupported manifest line: ${raw.trim()}`);
    }
  }

  for (const gate of Object.keys(manifest.gates)) if (!GATES.includes(gate)) errors.push(`Unknown gate: ${gate}`);
  return { manifest, errors };
}

export function parsePromotedSlice(trackerText) {
  const lines = String(trackerText || "").split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Next Slice\s*$/i.test(line));
  if (start < 0) return null;
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    const cleaned = line.replace(/^```text\s*|```$/g, "").trim();
    const match = cleaned.match(/^([A-Z0-9-]+)\s+\/\s+(codex\/[A-Za-z0-9._-]+)\b/);
    if (match) return { slice: match[1], branch: match[2] };
  }
  return null;
}

export function validateManifest({ manifest, changedFiles = [], trackerText = "", enforcePromotion = true, enforceDiffEvidence = true }) {
  const errors = [];
  const changed = new Set(changedFiles);
  if (!manifest.slice) errors.push("Manifest missing slice.");
  if (!manifest.branch) errors.push("Manifest missing branch.");
  if (manifest["promotion-mode"] && !["authority", "bootstrap"].includes(manifest["promotion-mode"])) errors.push("Invalid promotion-mode.");
  if (manifest["authority-files"] && manifest["promotion-mode"] !== "authority") errors.push("authority-files requires authority promotion mode.");
  for (const gate of GATES) validateGate(errors, gate, manifest.gates[gate], changed, enforceDiffEvidence);
  if (enforcePromotion) {
    const promoted = parsePromotedSlice(trackerText);
    if (!promoted) errors.push("Unable to parse promoted Next Slice.");
    else if (manifest.slice !== promoted.slice || manifest.branch !== promoted.branch) {
      errors.push(`Manifest ${manifest.slice} / ${manifest.branch} does not match promoted ${promoted.slice} / ${promoted.branch}.`);
    }
  }
  return errors;
}

function validateGate(errors, name, gate, changedFiles, enforceDiffEvidence) {
  if (!gate) return errors.push(`Manifest missing ${name}.`);
  for (const key of Object.keys(gate)) if (!["status", "evidence", "justification"].includes(key)) errors.push(`Unknown ${name} key: ${key}.`);
  if (!["required", "n/a"].includes(gate.status)) errors.push(`${name} status must be required or n/a.`);
  if (gate.status === "n/a" && String(gate.justification || "").trim().length < 20) errors.push(`${name} n/a justification must be at least 20 chars.`);
  if (gate.status !== "required") return;
  if (!gate.evidence) return errors.push(`${name} required gate missing evidence path.`);
  if (!existsSync(gate.evidence)) errors.push(`${name} evidence path does not exist: ${gate.evidence}`);
  else validateEvidenceHeadings(errors, name, gate.evidence);
  if (enforceDiffEvidence && !changedFiles.has(gate.evidence)) errors.push(`${name} evidence path is not in the slice diff: ${gate.evidence}`);
}

function validateEvidenceHeadings(errors, name, file) {
  const body = readFileSync(file, "utf8");
  for (const heading of REQUIRED_HEADINGS[name] || []) {
    if (!new RegExp(`^${escapeRegex(heading)}\\s*$`, "m").test(body)) errors.push(`${name} evidence missing required heading: ${heading}`);
  }
}

function clean(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

function parseInlineMap(value) {
  const body = String(value || "").trim();
  if (!body) return null;
  if (!body.startsWith("{") || !body.endsWith("}")) return null;
  const out = {};
  for (const part of body.slice(1, -1).split(/,\s*/).map((item) => item.trim()).filter(Boolean)) {
    const match = part.match(/^([A-Za-z-]+):\s*(.*)$/);
    if (!match) return null;
    if (Object.hasOwn(out, match[1])) return null;
    out[match[1]] = clean(match[2]);
  }
  return out;
}

function normalizeBlockScalars(source) {
  const lines = String(source || "").split(/\r?\n/);
  const normalized = [];
  for (let index = 0; index < lines.length; index += 1) {
    const block = lines[index].match(/^(    [A-Za-z-]+):\s*(>[+-]?|\|[+-]?)\s*$/);
    if (!block) {
      normalized.push(lines[index]);
      continue;
    }
    const body = [];
    while (index + 1 < lines.length && /^      /.test(lines[index + 1])) {
      index += 1;
      body.push(lines[index].replace(/^      /, "").trim());
    }
    const separator = block[2].startsWith("|") ? "\\n" : " ";
    normalized.push(`${block[1]}: ${body.join(separator).trim()}`);
  }
  return normalized.join("\n");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
