# NC-GOV-REPAIR-01 Data Lifecycle

## Scope

No domain/PHI/schema writes, migrations or production rows. Pinned Sentry target is
nonsecret metadata. Collector retains only count/status and base/head/target digest;
raw issue content is transient, bounded, discarded, and absent from logs/artifacts.
Token exists only in trusted process memory, never in the patch or evidence.
Private Git test fixtures are removed in finally blocks, including failures.

## Verification

Synthetic payload nonretention, size/identity/auth/transport negatives and fixture
cleanup are tested. Existing release/retention policies are unchanged. Full gates
and actual final-head owner review remain outstanding for the frozen adopted diff.
