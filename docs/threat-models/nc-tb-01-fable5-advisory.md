# NC-TB-01 Fable 5 Advisory Docs Threat Model

## Slice

`NC-TB-01 / codex/tenant-expand` is the promoted next runtime slice. This PR
does not implement tenant expansion. It adds advisory Fable 5 audit packets,
Obsidian context instructions, and docs-only gate evidence for later human
review.

## Scope

In scope:

- advisory review packets under `docs/reviews/`;
- repo-local Obsidian orientation instructions in `AGENTS.md`;
- docs-only `slice-gates.yaml` evidence for this PR.

Out of scope:

- runtime auth, tenant, routing, schema, dispatch, PHI, payment, API, database,
  migration, notification, and production behavior changes.

## Assets

- repo authority chain and tracker integrity;
- PHI and production identifier confidentiality;
- Fable 5 advisory output provenance;
- future `NC-TB-01` implementation evidence boundary;
- human reviewer trust in docs/advisory packets.

## Trust Boundaries

- Obsidian is advisory memory, not repo authority.
- Fable 5 output is untrusted advisory input.
- `docs/reviews/` advisory packets do not change `docs/plans/` authority.
- External model payloads must contain sanitized repo evidence only.

## STRIDE Findings

| Threat | Risk | Mitigation |
| --- | --- | --- |
| Spoofing | Advisory packets could look authoritative. | Frontmatter and body mark `source_of_truth: false` or advisory authority. |
| Tampering | Fable findings could be silently adopted. | Adoption requires a separate authority-chain commit. |
| Repudiation | Later reviewers may not know what was sent to Fable. | Packet lists payload boundary, run root, and required output schema. |
| Information disclosure | PHI, secrets, or production IDs could enter model payloads. | Packet forbids PHI, secrets, raw logs, patient data, and production IDs. |
| Denial of service | Large docs could break repo modularity gates. | Packet is split into sub-150-line parts. |
| Elevation of privilege | Obsidian/Fable could override repo workflow. | Docs state repo authority, tests, gates, and trackers win. |

## Residual Risk

Human reviewers must still verify any Fable-derived row before adoption.
This PR does not prove tenant backfill safety, RLS enforcement, PHI readiness,
credential trust, dispatch safety, or commercial viability.

## Verification

- `pnpm verify-slice`
- `pnpm verify-slice -- --run-root <run_root> --static`
- `pnpm verify-slice -- --run-root <run_root> --required-gates`
