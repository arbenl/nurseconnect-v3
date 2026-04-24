import { spawnSync } from "node:child_process";
import fs from "node:fs";
import process from "node:process";

import {
  appendPullRequestScannerProperties,
  appendScannerProperties,
  buildNativeScannerArgs,
} from "./sonar-scan-lib.mjs";

async function waitForSonarUp({ statusUrl, timeoutMs }) {
  const start = Date.now();
  const sleepMs = 1500;

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(statusUrl, {
        signal: AbortSignal.timeout(2500),
      });

      if (response.ok) {
        const data = await response.json().catch(() => null);
        if (data?.status === "UP") {
          return;
        }
      }
    } catch {
      // SonarQube can be slow to respond while booting.
    }

    await new Promise(resolve => setTimeout(resolve, sleepMs));
  }

  throw new Error(
    `Timed out waiting for SonarQube to report UP at ${statusUrl} after ${timeoutMs}ms.`
  );
}

function run(cmd, args, opts = {}) {
  const { allowFailure = false, ...spawnOptions } = opts;
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    ...spawnOptions,
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    if (allowFailure) {
      return result.status;
    }
    process.exit(result.status);
  }

  if (result.status === null) {
    const exitCode = 1;
    if (result.signal) {
      console.error(`Command "${cmd}" terminated by signal ${result.signal}.`);
    } else {
      console.error(`Command "${cmd}" terminated without an exit status.`);
    }

    if (allowFailure) {
      return exitCode;
    }
    process.exit(exitCode);
  }

  return result.status;
}

function readPullRequestContextFromEventPath() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return {
      pullRequestBase: "",
      pullRequestBranch: "",
      pullRequestKey: "",
    };
  }

  try {
    const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
    return {
      pullRequestBase: String(event?.pull_request?.base?.ref || "").trim(),
      pullRequestBranch: String(event?.pull_request?.head?.ref || "").trim(),
      pullRequestKey: String(event?.pull_request?.number || "").trim(),
    };
  } catch {
    return {
      pullRequestBase: "",
      pullRequestBranch: "",
      pullRequestKey: "",
    };
  }
}

const sonarToken = process.env.SONAR_TOKEN;
const sonarProjectKey = process.env.SONAR_PROJECT_KEY;
const sonarOrganization = process.env.SONAR_ORGANIZATION;

if (!sonarToken) {
  console.error(
    [
      "Missing SONAR_TOKEN.",
      "",
      "Set it in one of these ways:",
      "  1) Export it in your shell: export SONAR_TOKEN=...; pnpm sonar:scan",
      "  2) Configure SONAR_TOKEN in GitHub Actions secrets.",
    ].join("\n")
  );
  process.exit(2);
}

const cwd = process.cwd();
const sonarHostUrl = process.env.SONAR_HOST_URL ?? "http://host.docker.internal:9000";
const skipJreProvisioning = process.env.SONAR_SCANNER_SKIP_JRE_PROVISIONING === "true";
const scannerProperties = appendScannerProperties([`-Dsonar.host.url=${sonarHostUrl}`], {
  skipJreProvisioning,
});

if (sonarProjectKey) {
  scannerProperties.push(`-Dsonar.projectKey=${sonarProjectKey}`);
}

const isSonarCloud = sonarHostUrl.includes("sonarcloud.io");
if (isSonarCloud) {
  if (!sonarOrganization) {
    console.error(
      [
        "Missing SONAR_ORGANIZATION for SonarCloud scan.",
        "",
        "Set SONAR_ORGANIZATION in your environment or GitHub Actions variables.",
      ].join("\n")
    );
    process.exit(2);
  }
  scannerProperties.push(`-Dsonar.organization=${sonarOrganization}`);
}

const eventPullRequestContext = readPullRequestContextFromEventPath();
const pullRequestKey = String(
  process.env.SONAR_PULLREQUEST_KEY || eventPullRequestContext.pullRequestKey
).trim();
const pullRequestBranch = String(
  process.env.SONAR_PULLREQUEST_BRANCH ||
    process.env.GITHUB_HEAD_REF ||
    eventPullRequestContext.pullRequestBranch
).trim();
const pullRequestBase = String(
  process.env.SONAR_PULLREQUEST_BASE ||
    process.env.GITHUB_BASE_REF ||
    eventPullRequestContext.pullRequestBase
).trim();

if (pullRequestKey && (!pullRequestBranch || !pullRequestBase)) {
  console.error(
    [
      "Missing pull request branch context for Sonar PR analysis.",
      `SONAR_PULLREQUEST_KEY=${pullRequestKey}`,
      `SONAR_PULLREQUEST_BRANCH=${pullRequestBranch || "<empty>"}`,
      `SONAR_PULLREQUEST_BASE=${pullRequestBase || "<empty>"}`,
    ].join("\n")
  );
  process.exit(2);
}

const scannerPropertiesWithAnalysisContext = appendPullRequestScannerProperties(scannerProperties, {
  pullRequestBase,
  pullRequestBranch,
  pullRequestKey,
});

if (sonarHostUrl.includes("host.docker.internal:9000")) {
  await waitForSonarUp({
    statusUrl: "http://localhost:9000/api/system/status",
    timeoutMs: 120_000,
  });
}

const forceDocker = process.env.SONAR_SCANNER_FORCE_DOCKER === "true";
const shouldUseNativeArmScanner =
  !forceDocker && process.platform === "darwin" && process.arch === "arm64";

if (shouldUseNativeArmScanner) {
  try {
    const nativeArgs = buildNativeScannerArgs(scannerPropertiesWithAnalysisContext);
    const nativeStatus = run("pnpm", nativeArgs, { allowFailure: true });
    if (nativeStatus === 0) {
      process.exit(0);
    }
    console.error(`Native Sonar scanner failed with status ${nativeStatus}. Falling back to Docker scanner.`);
  } catch (error) {
    console.error("Native Sonar scanner invocation failed. Falling back to Docker scanner.");
    console.error(String(error));
  }
}

const dockerPlatform = process.env.SONAR_DOCKER_PLATFORM?.trim() ?? "";
const scannerImage =
  process.env.SONAR_SCANNER_IMAGE?.trim() || "sonarsource/sonar-scanner-cli:11.5";
const dockerArgs = ["run", "--rm"];

if (dockerPlatform) {
  dockerArgs.push("--platform", dockerPlatform);
}

if (process.platform === "linux") {
  dockerArgs.push("--add-host", "host.docker.internal:host-gateway");
}

dockerArgs.push(
  "-e",
  "SONAR_TOKEN",
  "-v",
  `${cwd}:/usr/src`,
  "-w",
  "/usr/src",
  scannerImage,
  "sonar-scanner",
  ...scannerPropertiesWithAnalysisContext
);

try {
  run("docker", dockerArgs);
} catch (error) {
  console.error("Failed to run sonar scan via Docker.");
  console.error("Make sure Docker Desktop is installed and running.");
  console.error(String(error));
  process.exit(1);
}
