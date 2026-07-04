const sourceFile = /^(?:apps\/web\/src|packages\/[^/]+\/src)\/.+\.(?:ts|tsx)$/;
const testFile = /(?:^|\/).+\.(?:test|spec)\.(?:ts|tsx)$/;

const rawSqlStatusUpdate =
  /update\s+(?:(?:"?\w+"?)\.)?"?service_requests"?\s+(?:(?:as\s+)?\w+\s+)?set[\s\S]{0,220}(?:(?:"?\w+"?)\.)?"?status"?\s*=/im;
const statusObjectAssignment =
  /\b(?:const|let|var)\s+(\w+)(?:\s*:\s*[^=\n]+)?\s*=\s*\{[\s\S]{0,320}(?:(?:["'])status(?:["'])|\bstatus)\s*:/gm;

function requestTableRefs(text) {
  const refs = new Set(["serviceRequests", "\\w+\\.serviceRequests"]);
  const schemaImport = /\bimport\s+\{([^}]+)\}\s+from\s+["']@nurseconnect\/database\/schema["']/g;
  for (const match of text.matchAll(schemaImport)) {
    for (const part of match[1].split(",")) {
      const alias = part.trim().match(/^serviceRequests(?:\s+as\s+(\w+))?$/);
      if (alias) refs.add(alias[1] || "serviceRequests");
    }
  }
  return [...refs];
}

function hasRawStatusUpdate(text) {
  return requestTableRefs(text).some((ref) =>
    new RegExp(`\\.update\\(\\s*${ref}\\s*\\)[\\s\\S]{0,320}\\.set\\(\\s*\\{[\\s\\S]{0,220}(?:(?:["'])status(?:["'])|\\bstatus)\\s*:`, "m")
      .test(text)
  );
}

function rawStatusObjectNames(text) {
  return [...text.matchAll(statusObjectAssignment)].map((match) => match[1]);
}

function hasIndirectRawStatusUpdate(text) {
  const names = rawStatusObjectNames(text);
  if (names.length === 0) return false;
  return requestTableRefs(text).some((ref) =>
    names.some((name) =>
      new RegExp(`\\.update\\(\\s*${ref}\\s*\\)[\\s\\S]{0,320}\\.set\\(\\s*${name}\\s*\\)`, "m").test(text)
    )
  );
}

export function findServiceRequestStatusWriteViolations(file, text) {
  if (!sourceFile.test(file) || testFile.test(file)) return [];
  if (!hasRawStatusUpdate(text) && !hasIndirectRawStatusUpdate(text) && !rawSqlStatusUpdate.test(text)) return [];
  return [
    `${file}: raw service_requests.status update must use domain-request AuthorizedTransition helpers`,
  ];
}

export function checkServiceRequestStatusWrites(files, readText) {
  return files.flatMap((file) => findServiceRequestStatusWriteViolations(file, readText(file)));
}
