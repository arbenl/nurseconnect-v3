## Naming Scheme

Use `NC-ENT-*` for enterprise audit work items so they do not collide with
Interdomestik `ENT-*` work or existing NurseConnect implementation bands.

Recommended register families:

- `NC-ENT-AUTH-*` for identity/authz/SSO/MFA/account lifecycle.
- `NC-ENT-TEN-*` for tenant isolation, RLS, memberships, facilities, residency.
- `NC-ENT-PHI-*` for PHI privacy, data lifecycle, encryption, audit, consent.
- `NC-ENT-CRED-*` for nurse identity, credentialing, verified evidence, trust.
- `NC-ENT-DISP-*` for request, dispatch, assignment, visit, retry, safety.
- `NC-ENT-PAY-*` for commercial model, provider boundary, payout, PCI.
- `NC-ENT-OPS-*` for support, incident, DR, SLO, audit export, release ops.
- `NC-ENT-UX-*` for UI/UX trust, accessibility, portal confidence, workflows.
- `NC-ENT-GATE-*` for release gates, reviewer evidence, ent-gate expansions.

Register items should map back to existing tracker slices when possible. They
must not silently promote new implementation work ahead of `NC-TB-01` unless
repo authority is deliberately updated.

Adoption gate for any `NC-ENT-*` item:

- Keep the initial item in `docs/reviews/` with `authority: advisory`.
- Validate the Fable 5 response against `schemaVersion:
  nc-ent-fable5-output-v1`.
- Verify the model manifest records `model: claude-fable-5`, `provider:
  claude`, `status: complete`, and no blocked route for the required reviewer.
- Record `MUST_FIX` disposition and human reviewer sign-off.
- Map the item to an existing tracker slice or propose a distinct authority
  update.
- Adopt it only through a separate commit that updates the authoritative
  tracker/program file and references the advisory source.
