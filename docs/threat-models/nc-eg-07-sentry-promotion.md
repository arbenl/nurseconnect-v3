# NC-EG-07 Sentry Promotion Threat Model

## Slice

NC-EG-07 / codex/sentry-config-isolation-delivery. Authority-only infrastructure promotion.

## Scope

Exact eight docs/manifest paths in the design. No Sentry runtime code is changed.

## Assets

Promotion authority, held product boundaries and truthful gate evidence.

## Trust Boundaries

Verified main null records to matching head infrastructure target; external review
is advisory. Existing checker and all required CI/finalizer gates remain authoritative.

## STRIDE Findings

- Spoofing/tampering: wrong branch, inconsistent target or surplus path must fail.
- Elevation: gate-infrastructure promotion must never imply 03A/03B permission.
- Disclosure: probes record only access/count; no credential or issue payload export.

## Residual Risk

Implementation is future separately reviewed work; this promotion is not its completion.

## Verification

Existing authority parser/checker, exact diff, focused scope checks, generated reviewer
pool and required gates must pass before PR. Failures remain blockers.

PR #119 merge/protection proof and NC-EG-09 closeout are recorded truthfully;
only NC-EG-07 is next. Canonical publication and real human review remain required.
