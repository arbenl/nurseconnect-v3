## Required Output Schema

Fable 5 should return one JSON object. No secrets, no PHI, no production data.

```json
{
  "auditId": "NC-ENT-AUDIT-2026-07-06",
  "packetVersion": "2026-07-06.2",
  "schemaVersion": "nc-ent-fable5-output-v1",
  "verdictType": "advisory_target_state_audit",
  "authorityBoundaryAccepted": true,
  "executiveSummary": {
    "targetState": "string",
    "highestRisks": ["string"],
    "highestLeverageMoves": ["string"]
  },
  "authorityConflicts": [
    {
      "item": "string",
      "conflict": "string",
      "recommendedHandling": "follow_repo_authority|request_repo_authority_update|defer"
    }
  ],
  "domainFindings": [
    {
      "id": "NC-ENT-PHI-001",
      "domain": "phi_privacy|tenant_isolation|authz|credential_trust|dispatch_safety|payments|audit_ops|release_gates|performance|ux_trust|enterprise_viability",
      "severity": "must_fix|should_fix|watch|accepted",
      "launchImpact": "launch_blocker|enterprise_blocker|automation_blocker|not_blocking",
      "finding": "string",
      "evidencePaths": ["string"],
      "missingEvidence": ["string"],
      "recommendedAction": "string",
      "mapsToExistingSlice": "string|null",
      "needsNewNcEntItem": true,
      "stopCondition": "string|null"
    }
  ],
  "blockers": [
    {
      "scope": "launch|enterprise_scale|payment_automation|multi_country|production_rls",
      "blocker": "string",
      "evidenceNeededToClear": ["string"]
    }
  ],
  "nextSliceCandidates": [
    {
      "candidateId": "NC-ENT-GATE-001",
      "relationshipToCurrentQueue": "after_NC-TB-01|maps_to_existing|requires_authority_update|defer",
      "title": "string",
      "whyNow": "string",
      "nonGoals": ["string"],
      "requiredEvidence": ["string"]
    }
  ],
  "thirtySixtyNinety": {
    "day30": ["string"],
    "day60": ["string"],
    "day90": ["string"]
  },
  "reviewerEvidencePlan": {
    "humanReviewers": ["string"],
    "modelEvidence": ["string"],
    "forbiddenEvidence": ["PHI", "secrets", "production identifiers"],
    "intakeShape": "string"
  },
  "residualQuestionsForArben": ["string"]
}
```

Before any downstream register or plan artifact is created, this JSON must pass
a local validation step against the schema version above. Until a repo-owned
checker exists, validation must be treated as manual evidence and cannot promote
anything into repo authority. A failed or partial schema parse means the
response remains raw advisory text only.
