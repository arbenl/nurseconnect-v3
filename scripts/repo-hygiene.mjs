#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const forbiddenTrackedPatterns = [
  { name: "TypeScript build info", pattern: /(^|\/).*\.tsbuildinfo$/ },
  { name: "test output transcript", pattern: /(^|\/)test_output(?:_[0-9]+)?\.txt$/ },
  { name: "server pid", pattern: /(^|\/)server\.pid$/ },
  { name: "phase artifact archive", pattern: /(^|\/)phase0_pack\.zip$/ },
  { name: "Firebase debug log", pattern: /(^|\/)firestore-debug\.log$/ },
  { name: "Next build output", pattern: /(^|\/)\.next\// },
  { name: "coverage output", pattern: /(^|\/)coverage\// },
  { name: "Playwright report", pattern: /(^|\/)playwright-report\// },
  { name: "test results", pattern: /(^|\/)test-results\// },
  { name: "Turbo cache", pattern: /(^|\/)\.turbo\// },
];

const activeSourcePrefixes = [
  "apps/",
  "packages/",
  "scripts/",
  "config/",
  ".github/",
];

const firebaseAllowedFiles = new Set([
  "apps/web/.eslintrc.json",
  "apps/web/src/env.ts",
  "scripts/repo-hygiene.mjs",
  "scripts/__tests__/env-secret-checks.test.mjs",
]);

const firebaseAllowedPrefixes = [
  "packages/database/drizzle/",
];

const firebaseTerms = /\b(firebase|firestore|FIREBASE|Firestore)\b/;

function gitLines(args) {
  const out = execFileSync("git", args, { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function fail(message, details = []) {
  process.stderr.write(`[repo-hygiene] FAIL: ${message}\n`);
  for (const detail of details) {
    process.stderr.write(`- ${detail}\n`);
  }
  process.exit(1);
}

function trackedFiles() {
  return gitLines(["ls-files"]);
}

function checkGeneratedArtifacts(files) {
  const failures = [];
  for (const file of files) {
    for (const rule of forbiddenTrackedPatterns) {
      if (rule.pattern.test(file)) {
        failures.push(`${file} (${rule.name})`);
      }
    }
  }
  if (failures.length > 0) {
    fail("tracked generated/local artifacts are present", failures);
  }
}

function checkActiveFirebase(files) {
  const candidates = files.filter((file) =>
    activeSourcePrefixes.some((prefix) => file.startsWith(prefix)) &&
    !firebaseAllowedFiles.has(file) &&
    !firebaseAllowedPrefixes.some((prefix) => file.startsWith(prefix))
  );
  const failures = [];
  for (const file of candidates) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    if (firebaseTerms.test(text)) {
      failures.push(file);
    }
  }
  if (failures.length > 0) {
    fail("active Firebase/Firestore source references are present", failures);
  }
}

const files = trackedFiles();
checkGeneratedArtifacts(files);
checkActiveFirebase(files);
process.stdout.write("[repo-hygiene] PASS tracked artifacts and active Firebase source checks\n");
