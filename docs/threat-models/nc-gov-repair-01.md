# NC-EG-09 / NC-GOV-REPAIR-01 Threat Model

## Slice

NC-EG-09; candidate preparation, not owner-adopted or ready for PR.

## Scope

Fixed-base exact-file governance amendment, hermetic fixture repair, owner coverage
and count-only trusted collector. No product/tenant/03A/03B implementation.

## Assets

Protected-main integrity, review legitimacy, existing nine checks, Sentry token,
non-PHI evidence, canonical intentional-null states and old bootstrap expiry.

## Trust Boundaries

Agent output is untrusted until owner independently reads diff and rederives hashes.
App publication is distinct from human review; raw credentials never reach author.
Candidate checker is execution evidence, not authority to install itself.
Privileged collector executes only frozen/adopted code; after merge installed base.

## STRIDE Findings

- Spoofing: reject fork/repo/event/checkout/branch conflict; verify actual App author.
- Tampering: exact regular-file set, pinned base, no null-state changes or symlinks.
- Repudiation: record owner adoption and real final-head review outside candidate.
- Disclosure: bound collector drops issue payload; rejects redirects and foreign IDs.
- Denial: cap response/time; expired base blocks publication without gate relaxation.
- Elevation: publisher refuses merge/review/admin/status operations; no owner creds.

## Residual Risk

Single operator is not two-person control. Owner must read actual diff and recompute
hashes; agent narrative is insufficient. Current finalizer is head-executed. Cached
main is not live server proof. Unsafe manual workflow stays undispatched by owner
discipline until separate wiring amendment; this patch alone does not enforce it.
The owner must not dispatch manual multi-agent hardening against repair/automation
PRs before that safe wiring. Adoption of this exact evidence adopts this constraint;
it is discipline, not a check, and never a waiver of one of the nine required checks.

## Verification

Preparation runs focused tests only. Full local/static/required gates, reviewer
pool, nine remote checks and protected real owner review still required before merge.
No pre-PR policy execution before exact owner adoption; never a candidate self-PASS.
