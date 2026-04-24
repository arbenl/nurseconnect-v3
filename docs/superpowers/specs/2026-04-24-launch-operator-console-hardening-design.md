# M12: Launch Operator Console Hardening Design

## Purpose

Reduce first-hour launch operator work by surfacing the existing M8 ops-status
signals directly in the admin dashboard. This is an operator workflow slice, not
a new monitoring subsystem.

## Scope

- Add admin-console visibility for active service-area count and verified
  available nurse supply.
- Add dispatch callouts for unassigned, stale assigned, stale enroute, and
  exception queue counts.
- Add payment follow-up callouts for authorization-without-payout gaps and
  recent failed authorization/payout audit events.
- Reuse the M8 ops-status field definitions, but compute the dashboard counts
  with a bounded dashboard-specific aggregate. Do not call the heavier
  `/api/admin/ops/status` projection from the SSR admin dashboard.
- Keep the public health endpoint and machine-readable ops-status endpoint
  unchanged.

## Non-Goals

- No database migration.
- No new public status page.
- No new payment automation.
- No new alert transport.
- No duplicate stale-request or payment-gap queries in the web app.

## Design

`packages/domain-admin-ops/src/ops-dashboard.ts` remains the admin dashboard
projection. It now composes:

- active request queue
- credential counts and pending credential items
- reassignment activity
- bounded launch signal counts for service-area coverage, verified available
  supply, stale dispatch, exception queue, and payment follow-up

`apps/web/src/app/admin/page.tsx` renders those counts in a dedicated launch
operator section:

- Launch prerequisites: active service areas and verified available nurse
  supply.
- Dispatch attention: unassigned requests, stale assigned, stale enroute, and
  exception queue.
- Payment follow-up: payment authorizations without payout, recent failed
  authorizations, and recent failed payouts.

The UI intentionally links to existing operator lanes instead of adding new
routes. Payment follow-up items link to the existing admin request detail page
so operators can inspect the payment/payout trace without a new route.

## Acceptance Criteria

- Admin dashboard includes all M8 ops-status fields relevant to launch
  operators.
- Existing `/api/admin/ops/status` response shape remains unchanged.
- Existing admin queue, exception queue, nurses, activity, users, and
  service-area routes remain unchanged.
- Domain dashboard tests cover the new ops-status composition.
- The dashboard render path avoids the full ops-status request-event scan and
  uses bounded/index-friendly dashboard queries instead.
- Type-check, lint, and focused architecture tests pass before PR.
