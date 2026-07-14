# NC-EG-06 Threat Model

## Slice

`NC-EG-06 / ent-gate-null-promotion-bootstrap`

## Scope

Fail-closed promotion policy for a null base tracker and its one-shot installer.

## Assets

- canonical tracker promotion authority
- ent-gate evidence integrity
- protected `main` merge policy

## Trust Boundaries

- base git commit versus pull-request head
- manifest and authorization record versus independently collected git diff
- local branch identity versus detached GitHub pull-request metadata

## STRIDE Findings

- Spoofing: detached PR branch text is accepted only when trusted event metadata binds its head repository to `GITHUB_REPOSITORY`, and the resolved source branch must equal the manifest/head target branch; exact base SHA and diff bind content.
- Tampering: closed path sets and complete enumeration reject surplus changes; every allowed authority path must remain a regular non-symlink head file, and all three canonical records must agree; shallow CI requires policy-base ancestry or an exact parent in the commit header before the base-to-HEAD tree diff, excluding attacker-controlled commit-message text.
- Repudiation: evidence records mode, resolved base SHA, branch, and errors.
- Information disclosure: inputs contain paths and policy metadata only.
- Denial of service: malformed or ambiguous tracker state fails closed.
- Elevation: standard behavior remains base-authoritative; special mode rejects tracker-path overrides and no generic bypass exists.

## Residual Risk

Gate implementation and its one-shot record share one reviewed PR, so CODEOWNERS,
reviewer evidence, branch protection, and the exact expiring base SHA remain part
of the trust model.

## Verification

Positive and negative tests cover standard, authority, bootstrap, detached-head,
three-record Markdown ambiguity/conflict, non-regular artifacts, incomplete diff, and forbidden paths.
