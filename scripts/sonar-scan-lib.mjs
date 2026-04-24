export function appendScannerProperties(scannerProperties, { skipJreProvisioning = false } = {}) {
  const properties = [...scannerProperties];

  if (
    skipJreProvisioning &&
    !properties.some(property => property.startsWith("-Dsonar.scanner.skipJreProvisioning="))
  ) {
    properties.push("-Dsonar.scanner.skipJreProvisioning=true");
  }

  return properties;
}

export function appendPullRequestScannerProperties(
  scannerProperties,
  { pullRequestKey = "", pullRequestBranch = "", pullRequestBase = "" } = {}
) {
  const properties = [...scannerProperties];

  if (!pullRequestKey) {
    return properties;
  }

  const prProperties = [
    ["key", pullRequestKey],
    ["branch", pullRequestBranch],
    ["base", pullRequestBase],
  ];

  for (const [suffix, value] of prProperties) {
    if (!value) {
      continue;
    }

    const propertyPrefix = `-Dsonar.pullrequest.${suffix}=`;
    if (!properties.some(property => property.startsWith(propertyPrefix))) {
      properties.push(`${propertyPrefix}${value}`);
    }
  }

  return properties;
}

export function buildNativeScannerArgs(scannerProperties) {
  return ["dlx", "--package=@sonar/scan", "sonar-scanner", ...scannerProperties];
}
