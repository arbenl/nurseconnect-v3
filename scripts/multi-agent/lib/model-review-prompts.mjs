const sensitivePatterns = [
  ["github-token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["bearer-token", /Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/i],
  ["database-url", /\bDATABASE_URL\s*=\s*\S+/i],
  ["auth-secret", /\b(BETTER_AUTH_SECRET|AUTH_SECRET)\s*=\s*\S+/i],
  ["possible-ssn", /\b\d{3}-\d{2}-\d{4}\b/],
  ["possible-mrn", /\b(?:MRN|medical\s*record\s*number)\s*[:=]\s*[A-Za-z0-9-]{6,}/i],
  ["possible-dob", /\b(?:DOB|date\s*of\s*birth)\s*[:=]\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i],
];

export function sensitiveMatches(text) {
  return sensitivePatterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function reviewerPrompt(packet) {
  return [
    "Review this NurseConnect slice design. Return concise findings grouped as MUST_FIX, SHOULD_FIX, NICE_TO_HAVE, and APPROVED_NOTES.",
    "Focus on architecture, auth/tenant/PHI safety, testability, rollback, and PR readiness. Do not request secrets or PHI.",
    "",
    packet,
  ].join("\n");
}

export function debatePrompt(packet, selected) {
  return [
    "You are one participant in a NurseConnect slice critique debate.",
    `Other requested reviewers: ${selected.join(", ")}.`,
    "Challenge assumptions, identify the strongest MUST_FIX risk, and name any finding you would reject with rationale.",
    "Do not request or expose secrets, PHI, patient details, or raw production data.",
    "",
    packet,
  ].join("\n");
}
