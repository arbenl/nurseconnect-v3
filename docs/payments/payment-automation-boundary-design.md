# Payment Automation Boundary Design

Date: 2026-04-25
Status: Draft - must be locked before any payment capture or payout execution
milestone
Scope: Payment provider identity, PCI boundary, provider callback
idempotency, platform fee schema, manual-era migration path

## Purpose

This spec defines the boundary between NurseConnect-owned payment state and
payment-provider-owned operations before any automated payment capture or
disbursement is implemented.

NurseConnect v1.0.0 launches in Kosovo with manual private-pay operations. The
existing `domain-payments` package provides traceability (payment
authorizations, nurse payouts, lifecycle state machines, admin audit trail) but
no provider integration. This spec ensures the provider integration is designed
as a local-market-compatible boundary, not retrofitted onto a live schema.

This is a design-only document. It does not change runtime behavior, database
schema, routes, UI, or launch gates.

## Problem

The gap between "admin manually records amounts" and "payment provider
automatically captures patient payments" is architecturally wider than the
schema suggests:

1. **No platform fee field.** `payment_authorizations.amount_cents` and
   `nurse_payouts.amount_cents` are independently set. There is no
   `platform_fee_cents` or `take_rate_basis_points` column linking the two
   through a margin calculation.

2. **No Kosovo-supported provider boundary is locked.** Stripe is not viable
   for a Kosovo operating entity. The first automation provider must be a
   Kosovo-supported checkout provider, with Paysera as the primary candidate.

3. **No provider event ledger.** Provider callbacks may be retried or arrive
   out of order. A single idempotency field on a payment row cannot safely
   deduplicate multiple events across a lifecycle.

4. **No entry source distinction.** Records created during the manual
   private-pay launch period are structurally identical to future
   provider-automated records. When automation ships, the system cannot
   distinguish manual-era records without a migration or heuristic.

5. **No PCI scope specification.** The schema does not store card data
   (correct), but there is no documented boundary for what the integration
   stores vs. tokenizes, and which checkout flow is used.

6. **No payout rail decision.** Patient checkout and nurse payout are separate
   financial flows. Automating patient collection through Paysera does not
   automatically solve contractor payout disbursement.

## Payment Provider Decision

### Provider selection

NurseConnect should use **Paysera Checkout** as the primary provider candidate
for the first payment automation milestone.

Paysera is selected for the first automation design because:

- Paysera supports Kosovo payment processing.
- Paysera provides hosted checkout / payment-window flows and server callback
  handling.
- Paysera fits the immediate launch need: collect patient private-pay visit
  fees and reconcile provider-confirmed payment status.
- It avoids forcing NurseConnect into Stripe Connect, which is not available
  for the Kosovo launch context.

The operator may select a different Kosovo-supported provider before this spec
is locked, but the architectural pattern remains provider-neutral:

1. NurseConnect calculates the visit charge and platform fee.
2. NurseConnect creates a provider payment/order request.
3. Patient pays in a provider-hosted checkout surface.
4. Provider sends a signed/verifiable callback.
5. NurseConnect records the provider event in an idempotent event ledger.
6. NurseConnect transitions the payment authorization through the existing
   lifecycle.
7. Nurse payout remains `owed` until manually settled or a separate payout rail
   is implemented.

### Provider roles by flow

| Flow | Launch provider | Launch behavior |
| --- | --- | --- |
| Patient visit checkout | Paysera candidate | Automated hosted checkout and callback reconciliation |
| Platform fee calculation | NurseConnect | Calculated and stored at authorization time |
| Nurse payout | Manual bank transfer | Tracked as `owed`, then marked `paid` by admin |
| Partner subscription billing | Deferred | Paddle may be evaluated only for software-like partner subscriptions |
| Marketplace split payout | Deferred | Requires separate Kosovo-supported payout rail decision |

### Paddle position

Paddle is not the default provider for patient-paid nursing visits.

Paddle is a merchant-of-record platform built primarily for software, SaaS,
consumer software, and games. NurseConnect's core paid product is an offline
human healthcare service delivered by a nurse. Paddle may be considered later
for software-like billing, such as referral partner subscriptions or premium
analytics access, only if the use case is approved by Paddle in writing.

Paddle must not be used as the default settlement path for patient visit
payments or nurse contractor payouts without explicit provider approval and a
new boundary amendment.

### Stripe position

Stripe is not a launch provider for NurseConnect Kosovo.

The schema may remain provider-neutral enough to support Stripe in a future
market or future operating entity, but this spec must not lock any
Stripe-specific field, event, or Connect payout assumption as the launch path.

## PCI Boundary

### What NurseConnect stores

| Data | Stored? | Location |
| --- | --- | --- |
| Provider name | Yes | `payment_authorizations.provider` |
| Provider payment/order ID | Yes | New provider-specific reference columns or `provider_reference` |
| Provider transaction ID | Yes, when provided | New provider-specific reference columns or `provider_reference` |
| Provider callback/event ID | Yes | `payment_provider_events.provider_event_id` |
| Patient checkout URL/token | Short-lived only | Server-side checkout creation response; avoid durable storage unless needed |
| Card last four digits | No by default | Read from provider only if later needed and approved |
| Full card number | No | Never touches NurseConnect systems |
| CVC / CVV | No | Never touches NurseConnect systems |
| Card expiration | No | Do not store |
| Nurse bank account details | No | Manual payout rail or external payout provider owns this |

### PCI compliance scope

NurseConnect must use provider-hosted checkout or provider-hosted payment
components for card collection. Card data must never enter NurseConnect
servers.

NurseConnect must not:

- Accept card data through its own forms or API routes.
- Store, log, or transmit full card numbers, CVCs, or card expiration dates.
- Proxy card data between the browser and the payment provider.

The exact PCI assessment category depends on the selected provider flow and
must be confirmed before implementation. The architecture goal is to keep
NurseConnect out of raw-card-data scope.

## Schema Additions

The following schema changes are required before payment automation ships.
All changes are additive - no existing columns are renamed, removed, or
retyped.

### `payment_authorizations` additions

| Column | Type | Purpose |
| --- | --- | --- |
| `platform_fee_cents` | `integer NOT NULL DEFAULT 0` | Platform's retained fee for this visit |
| `take_rate_basis_points` | `integer NOT NULL DEFAULT 0` | Take rate applied at authorization time |
| `entry_source` | `text NOT NULL DEFAULT 'manual'` | `'manual'` or `'provider'` |
| `provider_payment_id` | `text` | Provider payment ID, nullable for manual-era records |
| `provider_order_id` | `text` | NurseConnect order/request ID submitted to the provider, nullable for manual-era records |
| `provider_transaction_id` | `text` | Provider transaction ID, nullable until confirmed |

The existing `provider` and `provider_reference` columns remain for backward
compatibility. New provider-specific identifiers should be written to the new
columns, while `provider_reference` may retain the most operator-useful
human-readable reference.

### `nurse_payouts` additions

| Column | Type | Purpose |
| --- | --- | --- |
| `entry_source` | `text NOT NULL DEFAULT 'manual'` | `'manual'` or `'provider'` |
| `provider_payout_id` | `text` | Future payout provider ID, nullable for manual payouts |
| `provider_transaction_id` | `text` | Future payout transaction ID, nullable for manual payouts |

At the first automation milestone, nurse payouts remain manual. These columns
exist only to avoid another schema retrofit if a supported payout provider is
added later.

### `payment_provider_events` new table

Provider callback idempotency belongs in a dedicated event ledger, not on the
payment authorization or payout row.

| Column | Type | Purpose |
| --- | --- | --- |
| `id` | `uuid primary key` | Internal event row ID |
| `provider` | `text NOT NULL` | `paysera`, `paddle`, or future provider |
| `provider_event_id` | `text NOT NULL` | Provider callback/event ID or deterministic fallback key |
| `event_type` | `text NOT NULL` | Provider event/status type |
| `target_type` | `text NOT NULL` | `payment_authorization` or `nurse_payout` |
| `target_id` | `uuid` | Target row, nullable until resolved |
| `processing_status` | `text NOT NULL DEFAULT 'received'` | `received`, `processed`, `ignored`, `failed` |
| `payload` | `jsonb NOT NULL` | Redacted provider payload |
| `received_at` | `timestamp with time zone NOT NULL DEFAULT now()` | Callback receipt time |
| `processed_at` | `timestamp with time zone` | Successful processing time |
| `failure_reason` | `text` | Processing failure reason |

Required constraint:

```
UNIQUE (provider, provider_event_id)
```

If the provider does not supply a stable event ID, NurseConnect must derive a
deterministic event key from provider name, provider transaction/order ID,
status, and provider timestamp. The derived key rule must be documented in the
provider adapter before implementation.

### Patient-side provider identity

Do not add a durable patient payment profile column for the first Paysera
checkout milestone unless recurring payments or saved payment methods are in
scope.

If a future provider supports saved customer profiles, add provider-scoped
columns only after the recurring/saved-payment flow is specified.

## Callback Processing

### Callback events to handle

The first automation milestone handles patient payment authorization only.

| Provider signal | NurseConnect action |
| --- | --- |
| Payment confirmed / completed | Transition authorization from `authorized` to `captured` |
| Payment failed / rejected | Transition authorization to `failed` with `failure_reason` |
| Payment canceled / expired | Transition authorization to `voided` |
| Duplicate callback | Return success after confirming event ledger record exists |
| Unknown or unresolved payment | Store provider event as `ignored` or `failed`; alert operator if money movement may have occurred |

Exact provider event names must be filled in by the provider adapter design
after Paysera credentials and callback payload examples are available.

### Idempotency enforcement

Every provider callback handler must:

1. Verify the callback signature or provider-authenticity mechanism before any
   state mutation.
2. Extract or derive the `provider_event_id`.
3. Insert into `payment_provider_events` under the unique
   `(provider, provider_event_id)` constraint.
4. If the insert conflicts, return success without applying the lifecycle
   mutation again.
5. Resolve the target payment authorization by provider order/payment ID or
   NurseConnect request ID embedded in provider metadata.
6. Apply the lifecycle transition and event ledger update in one transaction.
7. Store only redacted payload data. Do not store card data or unnecessary PII.

### Callback verification

All incoming provider callbacks must be verified using the selected provider's
documented authenticity mechanism before processing.

Unverified callbacks must be rejected and must not write payment state. If an
unverified callback may correspond to real money movement, the route may write a
minimal security audit event without storing sensitive payload data.

## Provider-Owned vs. NurseConnect-Owned Fields

| Field | Owner | Mutated by |
| --- | --- | --- |
| `amount_cents` | NurseConnect | Admin (manual) or pricing service (automated) |
| `platform_fee_cents` | NurseConnect | Pricing service at authorization time |
| `take_rate_basis_points` | NurseConnect | Pricing service at authorization time |
| `currency` | NurseConnect | Set at authorization time |
| `status` | NurseConnect | State machine transitions driven by verified provider callbacks |
| `provider` | NurseConnect | Set to `paysera` or selected provider for automated entries |
| `provider_reference` | NurseConnect | Operator-friendly provider reference |
| `provider_payment_id` | Provider | Set from provider checkout/payment response |
| `provider_order_id` | NurseConnect | Set during checkout request creation; provider may echo or confirm it |
| `provider_transaction_id` | Provider | Set from provider callback/status lookup |
| `payment_provider_events.provider_event_id` | Provider or adapter | Stable callback dedupe key |
| `note` | NurseConnect | Admin operator (manual entries and overrides) |
| `failure_reason` | Provider or NurseConnect | Provider gives reason; NurseConnect stores safe summary |

## Manual-Era Record Migration

### Migration strategy

Existing manual-era records are **not retroactively modified** except through
additive defaults. The migration is forward-only:

1. Add the new columns with `DEFAULT` values that indicate manual origin:
   - `entry_source DEFAULT 'manual'`
   - `platform_fee_cents DEFAULT 0`
   - `take_rate_basis_points DEFAULT 0`
   - provider-specific ID columns nullable, no default

2. Create `payment_provider_events` empty. Do not synthesize provider events
   for historical manual rows.

3. All existing records automatically receive `entry_source = 'manual'`,
   `platform_fee_cents = 0`, and null provider IDs.

4. The automation code path sets `entry_source = 'provider'`, sets
   `provider = 'paysera'` or the selected provider, and populates
   provider-specific fields.

5. Queries, projections, and CRM summaries that need to distinguish manual
   from automated records filter on `entry_source`.

### Reconciliation rules

- Manual-era records with `platform_fee_cents = 0` are accepted as
  historical. They are not retroactively recalculated.
- Manual-era records where `nurse_payouts.amount_cents >
  payment_authorizations.amount_cents` are accepted as historical operator
  decisions. The automation must not retroactively reject them.
- Financial reporting that includes manual-era records must flag them as
  `manual` in any margin or revenue summary.
- Automated Paysera-era payment authorizations must be reconcilable by
  provider order/payment/transaction ID and event ledger rows.

## Lifecycle Compatibility

The existing state machines in `payment-lifecycle.ts` are preserved:

### Authorization transitions (existing)

```
authorized -> captured   (via 'capture')
authorized -> voided     (via 'void')
authorized -> failed     (via 'fail')
```

### Authorization transitions (automation additions)

```
(no new states at first Paysera automation launch)
```

If the selected provider requires asynchronous pending states, they must be
added as new enum values, not replacements for existing values.

### Payout transitions (existing)

```
owed -> paid      (via 'mark_paid')
owed -> failed    (via 'fail')
owed -> canceled  (via 'cancel')
```

### Payout transitions (first automation launch)

```
(no new states; nurse payouts remain manual)
```

Automated patient payment capture must not imply automated nurse settlement.
After a provider-confirmed patient payment and completed visit, the nurse payout
record remains `owed` until the admin confirms manual settlement.

## Nurse Payout Rail

The first automation milestone does not automate nurse payouts.

Launch behavior:

1. Patient payment is collected through Paysera or the selected provider.
2. NurseConnect records authorization capture after verified callback.
3. NurseConnect creates or keeps the nurse payout as `owed` after visit
   completion.
4. Operator pays the nurse outside the app by bank transfer or another approved
   local payout process.
5. Operator marks the nurse payout `paid` with a provider/reference note.

Future payout automation requires a separate payout boundary design that locks:

- supported Kosovo payout provider or bank transfer integration
- contractor identity/KYC requirements
- payout batch model vs. per-visit payout model
- reconciliation fields
- payout failure handling
- admin override and audit behavior

## Domain Package Ownership

| Concern | Owner |
| --- | --- |
| Price table and margin calculation | `@nurseconnect/domain-payments` |
| Authorization and payout lifecycle | `@nurseconnect/domain-payments` |
| Provider event idempotency policy | `@nurseconnect/domain-payments` |
| Paysera or selected provider SDK/protocol adapter | New platform adapter or `apps/web` server module |
| Provider callback route handler | `apps/web/src/app/api/webhooks/payments/[provider]/route.ts` |
| Payment provider event storage | `@nurseconnect/domain-payments` + database schema |
| Audit trail for automated payment events | `@nurseconnect/platform-telemetry` |
| Manual nurse payout confirmation | Existing admin payment trace surface |

The provider SDK integration should live in a platform adapter or server module,
not in `domain-payments`. The domain owns the business rules; the platform
adapter owns provider protocol details.

## Acceptance Criteria

- Stripe is explicitly excluded from the Kosovo launch provider path.
- Paysera is documented as the primary patient checkout candidate, with room
  for another Kosovo-supported provider before lock.
- Paddle is scoped away from patient visit settlement unless explicitly
  approved for the use case.
- PCI boundary is defined: NurseConnect never handles raw card data.
- Schema additions are additive and provider-neutral.
- Provider callback idempotency uses a dedicated `payment_provider_events`
  ledger with a unique `(provider, provider_event_id)` constraint.
- Manual-era record migration is forward-only with no retroactive
  modification.
- Existing lifecycle state machines are preserved; first automation only
  automates patient payment authorization capture.
- Nurse payouts remain manual until a separate payout rail is selected.
- Domain package ownership for pricing, provider integration, callback
  handling, and event ledger processing is assigned.
- This spec is locked before any payment capture or payout execution
  implementation slice begins.
