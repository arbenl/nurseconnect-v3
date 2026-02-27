import fs from "node:fs";
import path from "node:path";

const DEFAULT_SCAN_EXTENSIONS = [".log", ".txt", ".ndjson", ".json", ".md"];

function compilePatternSet(patterns = [], defaultFlags = "gi") {
  return patterns
    .map((entry) => {
      if (!entry || !entry.regex) {
        return null;
      }

      try {
        return {
          name: entry.name || "unnamed-pattern",
          regex: new RegExp(entry.regex, entry.flags || defaultFlags),
        };
      } catch (error) {
        return {
          name: entry.name || "invalid-pattern",
          regex: null,
          compileError: error.message,
        };
      }
    })
    .filter(Boolean);
}

function collectFiles(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const queue = [rootDir];
  const files = [];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(resolved);
      } else {
        files.push(resolved);
      }
    }
  }

  return files;
}

function scanTextWithPatterns(text, filePath, category, patterns) {
  const findings = [];

  for (const pattern of patterns) {
    if (!pattern.regex) {
      findings.push({
        category,
        file: filePath,
        pattern: pattern.name,
        message: `Pattern compile failure: ${pattern.compileError}`,
      });
      continue;
    }

    const match = text.match(pattern.regex);
    if (match && match.length > 0) {
      findings.push({
        category,
        file: filePath,
        pattern: pattern.name,
        evidence: String(match[0]).slice(0, 120),
      });
    }
  }

  return findings;
}

export function runComplianceAudit(options) {
  const {
    runDir,
    laneResults = [],
    complianceConfig = {},
  } = options;

  const scanExtensions = new Set(complianceConfig.scanExtensions || DEFAULT_SCAN_EXTENSIONS);
  const maxArtifactReadBytes = Number(complianceConfig.maxArtifactReadBytes || 262144);
  const phiPatterns = compilePatternSet(complianceConfig.phiLeakPatterns || []);
  const secretPatterns = compilePatternSet(complianceConfig.secretPatterns || []);

  const findings = [];
  const scannedFiles = [];

  const files = collectFiles(runDir);
  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();
    if (!scanExtensions.has(extension)) {
      continue;
    }

    let text = "";
    try {
      const raw = fs.readFileSync(filePath);
      text = raw.slice(0, maxArtifactReadBytes).toString("utf8");
      scannedFiles.push(filePath);
    } catch (error) {
      findings.push({
        category: "artifact-read-error",
        file: filePath,
        message: error.message,
      });
      continue;
    }

    findings.push(...scanTextWithPatterns(text, filePath, "phi-risk", phiPatterns));
    findings.push(...scanTextWithPatterns(text, filePath, "secret-risk", secretPatterns));
  }

  const auditRequiredLanes = complianceConfig.auditRequiredLanes || ["gatekeeper", "testing-agent", "verification-agent"];
  const laneResultMap = new Map(laneResults.map((result) => [result.lane, result]));

  for (const lane of auditRequiredLanes) {
    const found = laneResultMap.get(lane);
    if (!found) {
      findings.push({
        category: "auditability",
        lane,
        message: `Missing auditable output for ${lane}`,
      });
      continue;
    }

    if (!Array.isArray(found.commands) || found.commands.length === 0) {
      findings.push({
        category: "auditability",
        lane,
        message: `${lane} does not contain command-level evidence`,
      });
    }
  }

  const remediationNotes = [];
  if (findings.some((finding) => finding.category === "phi-risk")) {
    remediationNotes.push("Remove or redact PHI-like values from lane logs and artifacts before rerunning gates.");
  }
  if (findings.some((finding) => finding.category === "secret-risk")) {
    remediationNotes.push("Rotate leaked secrets/tokens immediately and replace raw logging with masked output.");
  }
  if (findings.some((finding) => finding.category === "auditability")) {
    remediationNotes.push("Ensure gatekeeper/testing/verification lanes emit command outputs and exit codes for traceability.");
  }

  return {
    status: findings.length === 0 ? "pass" : "fail",
    findings,
    remediationNotes,
    scannedFiles,
    checkedAt: new Date().toISOString(),
  };
}
