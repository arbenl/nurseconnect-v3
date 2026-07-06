## Audit Questions For Fable 5

Answer these as target-state questions: where should NurseConnect be, what
evidence proves it, what blocks it, and what sequence gets there.

### 1. Current Authority And Scope

- Which current repo authorities constrain this audit?
- Which existing decisions should be treated as accepted unless new evidence
  justifies an explicit repo update?
- Where do old roadmaps, wiki memory, or Interdomestik analogies risk
  conflicting with NurseConnect authority?
- What must remain out of scope for this setup packet?

### 2. Launch Versus Enterprise Scale

- Which capabilities are mandatory for controlled launch?
- Which capabilities are mandatory only for enterprise-scale readiness?
- Which enterprise items must be designed before launch even if implemented
  later because retrofitting them would create high risk?
- Which open blockers should stop launch, and which should stop only enterprise
  sales or multi-tenant expansion?

### 3. Healthcare And PHI Privacy

- What is the target-state PHI privacy posture for request, patient, visit,
  credential, audit, support, logs, notifications, and evidence artifacts?
- Which PHI data lifecycle controls are missing or only planned?
- What evidence should prove PHI inventory, read audit, retention, erasure,
  encryption/key management, BAA/vendor review, and breach response?
- What data must remain plaintext for dispatch or operations, and what
  compensating controls are required?

### 4. Tenant And Account Isolation

- Is the accepted organization plus branch/facility tenant shape sufficient for
  the target market?
- What evidence should prove default bootstrap, backfill, guard mode, observe
  mode, staging restrictive mode, production RLS, and out-of-band access review?
- Which tenant isolation stop conditions must pause `NC-TB-*`?
- What regional, jurisdiction, or data-residency decisions must be made before
  multi-country production use?

### 5. AuthN, AuthZ, And Account Lifecycle

- Does the current identity/authz direction support enterprise buyers, SSO/SCIM,
  MFA, facility-scoped roles, and support impersonation controls?
- What remaining account lifecycle risks exist after the completed identity and
  proof-token slices?
- What evidence should prove minimum-necessary access, policy/RLS parity,
  support/admin access, and negative authorization paths?

### 6. Nurse Identity And Credential Trust

- What should target-state nurse verification, credential evidence,
  jurisdiction licensing, expiration, suspension, consent, and re-verification
  look like?
- What evidence should prove verified credential trust without leaking clinical
  or credential PHI?
- Which trust decisions belong to tenant/facility context versus platform
  nurse supply identity?

### 7. Request, Dispatch, Visit, And Safety

- What target-state safety guarantees are required for request creation,
  allocation, nurse notification, acceptance, visit completion, redispatch, and
  stale-open handling?
- Which side effects must move to outbox consumers?
- What concurrency, retry, idempotency, duplicate-assignment, and rollback
  evidence is required?
- What stop conditions should pause dispatch or intake?

### 8. Payments And Commercial Model

- What commercial decisions must be locked before payment automation?
- What target-state payment boundary keeps NurseConnect out of raw-card-data
  scope?
- What evidence should prove provider callback idempotency, platform fee
  invariants, payout traceability, provider support, PCI boundary, and manual to
  automated migration safety?
- Which payment risks are launch blockers versus automation blockers?

### 9. Audit Logs, Support, And Incident Ops

- What target-state audit model is needed for admin actions, PHI reads,
  support access, platform events, tenant audit exports, and immutable evidence?
- What support workflows are needed without creating a PHI leak path?
- What incident, breach, DR, SLO, alerting, and export evidence is required?
- Which incident types require pause-intake or rollback?

### 10. Release Gates And Human Reviewer Evidence

- Are current `verify-slice`, ent-gates, PR Finalizer, reviewer pool, Sonar,
  GitGuardian, and branch-protection evidence enough for enterprise readiness?
- What human reviewer evidence is required for PHI, auth, tenancy, money,
  clinical, and schema slices?
- Which findings should be `MUST_FIX`, which can be deferred, and what technical
  rejection standard is acceptable?
- How should Fable 5 evidence be recorded without becoming authority?

### 11. Performance And Scale

- What performance budgets matter for request creation, dispatch, tenant
  context, RLS, dashboards, audit export, and background jobs?
- Which budgets should become `ent-perf` evidence?
- What realistic load/scenario evidence should be gathered before enterprise
  scale commitments?

### 12. UI/UX Trust

- Which product surfaces must earn trust for patients, nurses, partner users,
  coordinators, admins, support, and operators?
- What trust signals are required for credential status, request state,
  assignment status, payment state, privacy, errors, and incident mode?
- What usability/accessibility evidence should be required before launch versus
  enterprise scale?

### 13. Enterprise Viability And Next Slices

- Does the current Phase C queue still produce the right target state?
- Which `NC-ENT-*` audit findings should map to existing slices, and which need
  new future slices?
- What are the highest-value next-slice candidates after `NC-TB-01`, assuming
  repo authority remains unchanged?
- What should the 30/60/90-day path be?
