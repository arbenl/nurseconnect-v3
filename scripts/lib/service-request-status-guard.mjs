const sourceFile = /^(?:apps\/web\/src|packages\/[^/]+\/src)\/.+\.(?:ts|tsx)$/;
const testFile = /(?:^|\/).+\.(?:test|spec)\.(?:ts|tsx)$/;

const rawSqlStatusUpdate =
  /update\s+(?:(?:"?\w+"?)\.)?"?service_requests"?\s+(?:(?:as\s+)?\w+\s+)?set[\s\S]{0,220}(?:(?:"?\w+"?)\.)?"?status"?\s*=/im;
const rawSqlNurseStatusWrite =
  /update\s+(?:(?:"?\w+"?)\.)?"?nurses"?\s+(?:(?:as\s+)?\w+\s+)?set[\s\S]{0,220}(?:(?:"?\w+"?)\.)?"?status"?\s*=/im;
const statusObjectAssignment =
  /\b(?:const|let|var)\s+(\w+)(?:\s*:\s*[^=\n]+)?\s*=\s*\{[\s\S]{0,320}(?:(?:["'])status(?:["'])|\bstatus)\s*:\s*(?:"([a-z_]+)"|'([a-z_]+)')?/gm;

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

function nurseTableRefs(text) {
  const refs = new Set(["nurses", "\\w+\\.nurses"]);
  const schemaImport = /\bimport\s+\{([^}]+)\}\s+from\s+["']@nurseconnect\/database\/schema["']/g;
  for (const match of text.matchAll(schemaImport)) {
    for (const part of match[1].split(",")) {
      const alias = part.trim().match(/^nurses(?:\s+as\s+(\w+))?$/);
      if (alias) refs.add(alias[1] || "nurses");
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

function hasRawNurseStatusWrite(text) {
  return nurseTableRefs(text).some((ref) =>
    new RegExp(`\\.(?:update|insert)\\(\\s*${ref}\\s*\\)[\\s\\S]{0,500}\\.(?:set|values)\\(\\s*\\{[\\s\\S]{0,260}(?:(?:["'])status(?:["'])|\\bstatus)\\s*:`, "m")
      .test(text) ||
    new RegExp(`\\.onConflictDoUpdate\\(\\s*\\{[\\s\\S]{0,500}\\bset\\s*:\\s*\\{[\\s\\S]{0,260}(?:(?:["'])status(?:["'])|\\bstatus)\\s*:`, "m")
      .test(text)
  ) || hasIndirectRawNurseStatusWrite(text) || rawSqlNurseStatusWrite.test(text);
}

function rawNurseStatusValues(text) {
  const values = [];
  for (const ref of nurseTableRefs(text)) {
    const patterns = [
      new RegExp(`\\.(?:update|insert)\\(\\s*${ref}\\s*\\)[\\s\\S]{0,500}\\.(?:set|values)\\(\\s*\\{[\\s\\S]{0,260}(?:(?:["'])status(?:["'])|\\bstatus)\\s*:\\s*["']([a-z_]+)["']`, "gm"),
      new RegExp(`\\.onConflictDoUpdate\\(\\s*\\{[\\s\\S]{0,500}\\bset\\s*:\\s*\\{[\\s\\S]{0,260}(?:(?:["'])status(?:["'])|\\bstatus)\\s*:\\s*["']([a-z_]+)["']`, "gm"),
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) values.push(match[1]);
    }
  }
  for (const assignment of nurseStatusObjectUsage(text)) {
    if (assignment.status) values.push(assignment.status);
  }
  return values;
}

function rawStatusObjectAssignments(text) {
  return [...text.matchAll(statusObjectAssignment)].map((match) => ({
    name: match[1],
    status: match[2] || match[3] || null,
  }));
}

function rawStatusObjectNames(text) {
  return rawStatusObjectAssignments(text).map((assignment) => assignment.name);
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

function nurseStatusObjectUsage(text) {
  const assignments = rawStatusObjectAssignments(text);
  if (assignments.length === 0) return [];
  return nurseTableRefs(text).flatMap((ref) =>
    assignments.filter(({ name }) =>
      new RegExp(`\\.(?:update|insert)\\(\\s*${ref}\\s*\\)[\\s\\S]{0,500}\\.(?:set|values)\\(\\s*${name}\\s*\\)`, "m")
        .test(text) ||
      new RegExp(`\\.onConflictDoUpdate\\(\\s*\\{[\\s\\S]{0,500}\\bset\\s*:\\s*${name}\\b`, "m")
        .test(text)
    )
  );
}

function hasIndirectRawNurseStatusWrite(text) {
  return nurseStatusObjectUsage(text).length > 0;
}

export function findServiceRequestStatusWriteViolations(file, text) {
  if (!sourceFile.test(file) || testFile.test(file)) return [];
  if (!hasRawStatusUpdate(text) && !hasIndirectRawStatusUpdate(text) && !rawSqlStatusUpdate.test(text)) return [];
  return [
    `${file}: raw service_requests.status update must use domain-request AuthorizedTransition helpers`,
  ];
}

export const nurseStatusWriteAllowlist = new Map([
  ["packages/domain-nurse/src/credential-lifecycle.ts", new Set(["submitted"])],
  ["packages/domain-nurse/src/nurse-record.ts", new Set(["draft"])],
  ["packages/domain-nurse/src/self-service.ts", new Set(["submitted"])],
]);

export function findNurseStatusWriteViolations(file, text) {
  if (!sourceFile.test(file) || testFile.test(file) || !hasRawNurseStatusWrite(text)) return [];
  const allowed = nurseStatusWriteAllowlist.get(file);
  if (allowed) {
    const values = rawNurseStatusValues(text);
    if (values.length > 0 && values.every((status) => allowed.has(status))) return [];
  }
  return [
    `${file}: raw nurses.status write must use domain-nurse VerifiedCredentialEvidence helpers`,
  ];
}

export function checkServiceRequestStatusWrites(files, readText) {
  return files.flatMap((file) => [
    ...findServiceRequestStatusWriteViolations(file, readText(file)),
    ...findNurseStatusWriteViolations(file, readText(file)),
  ]);
}
