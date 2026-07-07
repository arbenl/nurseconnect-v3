# NC-TB-01 Service Request Events Meta Classification

Date: 2026-07-07
Status: Accepted for NC-TB-01 implementation

## Scope

This evidence classifies current `service_request_events.meta` key shapes before
NC-TB-01 adds nullable tenant ownership to `service_request_events`.

## Event Inventory

| Event type | Current meta shape | Classification | NC-TB-01 decision |
|---|---|---|---|
| `request_created` | `null` | operational | include |
| `request_assigned` | `{ nurseUserId }` | internal identifier; PHI-adjacent by relationship | include; never print raw values in evidence |
| `request_accepted` | `null` | operational | include |
| `request_rejected` | `null` or `{ reason }` | possible PHI/free text | include; backfill must not inspect or print value |
| `request_enroute` | `null` | operational | include |
| `request_completed` | `null` | operational | include |
| `request_canceled` | `null` | operational | include |
| `request_reassigned` | `{ previousNurseUserId, newNurseUserId }` | internal identifiers; PHI-adjacent by relationship | include; never print raw values in evidence |
| `request_needs_review` | `null` or `{ reason }` | possible PHI/free text | include; backfill must not inspect or print value |
| `request_declined` | `{ reason }` | possible PHI/free text | include; backfill must not inspect or print value |
| `request_unfulfilled` | `{ reason }` | possible PHI/free text | include; backfill must not inspect or print value |
| `request_reopened` | `null` | operational | include |

## Evidence Paths

- `apps/web/src/server/requests/allocate-request.ts`
- `packages/domain-dispatch/src/assignment-policy.ts`
- `packages/domain-dispatch/src/reassignment-policy.ts`
- `packages/domain-request/src/request-actions.ts`
- `packages/contracts/src/request-events.ts`

## Backfill Rules

- Derive `service_request_events.organization_id` from the parent
  `service_requests.organization_id`.
- Do not parse, rewrite, log, export, or print `meta` values during backfill.
- Evidence may report counts by event type and null/non-null meta status only.
- Any discovered meta key outside this inventory is a stop condition until this
  evidence is amended and reviewed.
