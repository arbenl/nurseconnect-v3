---
plan_role: architecture_program
status: active
source_of_truth: false
authority_note: "current-program.md is the singular source of truth; this program defers to it on conflict."
owner: platform
last_reviewed: 2026-06-02
tracker_path: docs/plans/nurseconnect-enterprise-architecture-tracker.md
current_program_bridge: docs/plans/current-program.md
---

# NurseConnect Enterprise Architecture Program

## Goal

Move NurseConnect from a single-tenant healthcare staffing application to an enterprise-ready, tenant-isolated, auditable, and compliance-aware platform.

This program adapts Interdomestik's strongest execution patterns:

- canonical program and tracker documents
- milestone-based architecture queue
- strict slice workflow
- repo-owned guardrails before broad migrations
- copy-and-own platform mechanisms from Interdomestik where they are domain-neutral

It deliberately does **not** copy Interdomestik business-domain semantics such as membership billing, insurance claims, lead funnels, or sales deals.

## What Enterprise-Ready Means

NurseConnect reaches enterprise readiness when these are true:

- every domain row has an enforceable tenant boundary
- the auth/domain identity bridge cannot be null or ambiguous
- authorization can express tenant, role, branch/facility/resource, jurisdiction, and PHI minimum-necessary constraints
- state changes can emit durable events without losing atomicity
- assignment notifications and retries are reliable without blocking request transactions
- CRM primitives exist for organizations, facilities, contacts, notes, tasks, activities, and communications
- PHI read access is audited and sensitive fields have an encryption/key-management decision
- CI guards prevent architecture and tenant-boundary regression

## Milestones

```text
NC-E0  Operating System + Stabilization
       Canonical program/tracker, identity bridge, auth rollout gate, env/secret checks,
       repo hygiene, module-boundary guard, DR baseline.

NC-E1  Tenant/RLS Foundation
       Shared-schema RLS mechanism, tenant context wrapper, tenant query helpers,
       DB role assertion, default tenant/backfill plan, tenant-isolation tests.

NC-E2  Identity/AuthZ Platform
       Platform identity projection discipline, tenant membership, in-process ABAC,
       policy tests, minimum-necessary field access groundwork.

NC-E3  Notifications + Events Backbone
       Post-commit non-PHI assignment notifications, persisted outbox schema,
       worker-claim loop, retry/backoff, dead-letter policy, scheduled stale-open redispatch.

NC-E4  Enterprise CRM Primitives
       Organizations/facilities/contacts, polymorphic notes, tasks/work queues,
       activities timeline, communication logs, referral-partner fold-in.

NC-E5  Compliance/Observability Hardening
       PHI data classification, PHI read audit, encryption/key-management implementation,
       retention/erasure, BAA/vendor inventory, SLOs and exportable audit evidence.

NC-E6  Platformization
       Versioned API/OpenAPI, webhooks, integration adapters, enterprise admin,
       advanced rules automation, optional physical tenant isolation only if a customer requires it.
```

## Interdomestik Reuse Policy

### Copy-And-Own Candidates

- RLS tenant context wrapper pattern
- tenant query helper and post-query assertion pattern
- fail-closed DB role assertion pattern
- tenant isolation abuse-test pattern
- architecture boundary guard pattern

### Adapt Candidates

- org/branch schema shape
- task/work queue shape
- activity timeline shape
- notes shape, rewritten as polymorphic NurseConnect notes
- communication layer shape
- outbox interface/tests, with new NurseConnect persistence

### Do Not Reuse

- insurance claims
- membership billing
- lead/deal sales pipeline
- UTM/lead scoring
- business-domain stage names
- any PII assumptions that are not valid for PHI

## Closed Program Decisions

1. Tenant shape: organization plus branch/facility/location from v1.
2. Marketplace model: customer demand is tenant/facility scoped; nurse supply is platform-level only for non-PHI routing identity, with tenant/facility/jurisdiction-specific eligibility and assignment context.
3. Country/jurisdiction: operating and compliance scope, not the tenant boundary. Multi-country production rollout requires regional/data-residency topology review before launch.

## Open Program Decisions

1. Regulatory scope: US HIPAA only, or international/GDPR too.
2. Notification vendor and BAA path.
3. Worker runtime for outbox/jobs.
4. Whether any enterprise buyer requires physical tenant isolation later.
