# ADR-004: Async Backbone — Transactional Outbox + Jobs

**Status:** Proposed
**Date:** 2026-06-02
**Related:** ADR-001 (tenancy); report §2.9, §3 R4, §9 Phase 1/2

## Context

NurseConnect has **no async backbone**. Dispatch runs **synchronously inside the create-request transaction** (`apps/web/src/server/requests/allocate-request.ts`: create request → append `request_created` event → `selectDispatchCandidate` → `assignRequestToNurse`, all in one `db.transaction`). Consequences (report R4): side effects (notifications, payouts, re-dispatch) have nowhere reliable to run; a request with no available nurse is left `open` with **no retry mechanism**; there is no scheduled work.

NurseConnect already has the right primitive half-built: an append-only `service_request_events` log written in the same transaction as state changes. Interdomestik shows the right **contract**: `packages/domain-crm/src/outbox/` defines `CrmOutboxPort` with `appendEvent`/`appendEvents` (idempotent → `enqueued|duplicate`), `claimPendingEvents({ limit, lockedBy, now, tenantId })`, `markEventPublished`, and `markEventFailed({ error, nextAvailableAt })` — i.e. worker-claim + idempotency + retry/backoff.

**Verified caveat:** that folder is **interface + types + mutations + tests only**. There is **no persisted outbox table in Interdomestik's schema** and **no concrete Drizzle/SQL adapter**. So Interdomestik gives NurseConnect a high-quality *port and executable spec*, not a droppable implementation — the persistence (table, `SKIP LOCKED` claim query, dead-letter, indexes, archival) is **net-new work** to be estimated, not copied.

## Decision Drivers

- Reliable side effects (at-least-once with idempotent consumers).
- Atomicity: an event must be persisted iff its state change commits.
- Scheduled work (re-dispatch stale `open` requests; retention/erasure jobs later).
- Avoid premature heavy infrastructure (Kafka) for current scale.
- Tenant-awareness (claim/process per tenant — ADR-001).

## Options

1. **Keep inline side effects.** Status quo. No reliability, no retries, couples side effects to the request transaction.
2. **Postgres transactional outbox + a Postgres-backed worker** (pg-boss / Graphile Worker, or a hand-rolled claim loop like Interdomestik's). Outbox row written in the same transaction as the state change; a worker claims, processes, marks published/failed with backoff.
3. **External broker (SQS/Kafka) + outbox.** Outbox still needed for atomicity; broker adds throughput and decoupling at operational cost.

## Decision (recommended)

**Option 2: a Postgres-native transactional outbox + worker**, porting Interdomestik's `CrmOutboxPort` interface into a `platform-events` package, with `platform-jobs` for scheduled/recurring work. Write outbox rows in the same transaction as domain state changes (extend the existing `service_request_events` discipline). A worker claims pending rows (`FOR UPDATE SKIP LOCKED` — already used elsewhere in dispatch), processes with **idempotent consumers**, and records `published`/`failed` with `nextAvailableAt` backoff. Defer an external broker (Option 3) until metrics justify it.

Sequencing (report §9): **Phase 1** ships *best-effort synchronous* assignment notifications (decoupled from this ADR so nurses get notified before the full outbox exists). **Phase 2** introduces the outbox/jobs and promotes notifications, payout fan-out, and **stale-`open` re-dispatch** to reliable async.

Rationale: the outbox is mandatory for atomicity regardless of transport, and a Postgres-backed worker matches current scale without new infrastructure. The codebase already uses `SKIP LOCKED` and an event log, so the pattern is idiomatic here.

## Consequences

**Positive:** atomic state-change-plus-event; at-least-once delivery with retries/backoff; a home for scheduled re-dispatch and retention jobs; no new infra; reuses a proven interface.

**Negative / costs:** consumers must be **idempotent** (dedupe key); a worker process/runtime must be operated (and on Vercel, a cron/queue mechanism chosen); outbox table growth needs archival; ordering is per-key, not global.

## Verification

- Idempotency test: replaying an outbox event produces no duplicate side effect.
- Atomicity test: a rolled-back transaction leaves no outbox row; a committed one always does.
- Retry/backoff test: a failing consumer is retried per `nextAvailableAt`, then dead-lettered.
- Re-dispatch test: a request left `open` with no candidate is re-attempted by the scheduler.

## Open items

- Worker runtime on Vercel (cron + queue vs a small dedicated worker service).
- Outbox retention/archival policy.
- Whether to share one outbox across domains or one per bounded context.
