# NurseConnect Commercial Model Spec

Date: 2026-04-25
Status: Draft — requires operator sign-off before M17
Scope: Visit pricing, platform margin, nurse payout rate, referral partner
economics, manual payment assumptions, automation invariants

## Purpose

This spec locks the NurseConnect revenue model before any payment automation or
CRM financial projection is built.

The program has mature financial traceability (payment authorizations, nurse
payouts, payout lifecycle state machines) but no locked pricing logic. Without
this spec, payment automation will be designed against an undefined revenue
model, and CRM projections may summarize payments for a pricing structure that
does not yet exist.

This is a commercial design document. It does not change runtime behavior,
database schema, routes, UI, or launch gates.

## Problem

The current payment domain (`@nurseconnect/domain-payments`) records amounts
set by the admin operator without programmatic constraints:

- `payment_authorizations.amount_cents` is the patient charge, set manually.
- `nurse_payouts.amount_cents` is the nurse disbursement, set manually.
- There is no field linking the two amounts through a margin or fee calculation.
- There is no domain function that enforces a minimum margin or validates that
  the payout does not exceed the authorization.

This is correct for manual private-pay launch. It becomes a liability when:

- Payment automation needs to calculate the split between platform fee and
  nurse payout.
- CRM projections need to show revenue, margin, or payout summaries.
- Referral partners ask about the cost structure to justify the channel
  internally.
- Nurse contractors compare NurseConnect rates to other platforms.

## Visit Pricing Model

### Visit fee structure

NurseConnect charges a **per-visit flat fee** determined by two axes:

| Axis | Values | Effect on price |
| --- | --- | --- |
| Request type | `scheduled`, `same_day` | Same-day carries a convenience premium |
| Care type | Freeform string at launch; codified categories post-launch | Complex care types may carry a higher rate |

The per-visit flat fee is the correct structure for launch because:

- Hourly billing requires verified time tracking, which is not built.
- Hybrid models add operator complexity before volume justifies it.
- Flat fees are transparent to patients and predictable for nurses.

### Price table

The operator must lock a price table before M17 that specifies:

| Visit category | Patient charge (cents) | Currency |
| --- | --- | --- |
| Scheduled visit — standard care | TBD by operator | EUR |
| Same-day visit — standard care | TBD by operator | EUR |

Additional rows may be added per care type as the care type taxonomy is
codified. The price table is operator-owned, not hardcoded in application
logic.

### Price table storage

At launch, the price table is an operator-maintained reference (Notion,
internal doc, or admin config) used when the admin manually records payment
authorizations.

When payment automation is built, the price table must be stored in a
`visit_pricing` table or configuration source that `domain-payments` reads to
calculate the patient charge. The automation boundary design
(`docs/payments/payment-automation-boundary-design.md`) must specify the
storage mechanism before implementation.

## Platform Margin

### Take rate model

NurseConnect retains a **fixed percentage take rate** of the patient charge:

```
percentageFeeCents = floor(patientChargeCents * takeRateBasisPoints / 10000)
platformFeeCents = max(percentageFeeCents, minimumPlatformFeeCents)
nursePayoutCents = patientChargeCents - platformFeeCents
```

| Parameter | Value | Owner |
| --- | --- | --- |
| `takeRateBasisPoints` | TBD by operator (e.g., 2000 = 20%) | Operator / commercial |
| Minimum platform fee | TBD by operator (e.g., 500 cents = €5.00) | Operator / commercial |
| Maximum nurse payout | `patientChargeCents - platformFeeCents` | Derived |

### Margin invariants

These invariants must hold in all payment flows — manual or automated:

1. `nursePayoutCents <= patientChargeCents` — the nurse payout must never
   exceed the patient charge.
2. `platformFeeCents >= minimumPlatformFeeCents` — the platform fee must meet
   the minimum floor.
3. `platformFeeCents + nursePayoutCents == patientChargeCents` — no rounding
   leak; the split must be exact.
4. Both amounts must use the same `currency`.
5. `minimumPlatformFeeCents <= patientChargeCents` — the minimum fee cannot
   make the visit economically impossible.
6. The take rate is applied at authorization time, not retroactively.

### Manual launch behavior

During manual private-pay launch, the admin sets both
`payment_authorizations.amount_cents` and `nurse_payouts.amount_cents`
independently. The margin invariants above are operator discipline, not
enforced by the application.

When payment automation is built, the domain must enforce invariants 1–6
programmatically.

## Nurse Payout Rate Model

### Contractor rate structure

Nurses are paid a **per-visit fixed rate** derived from the patient charge and
the platform take rate:

```
nursePayoutCents = patientChargeCents - platformFeeCents
```

This means the nurse rate is a function of the visit price and the take rate,
not a separately negotiated value. This is the correct structure for launch
because:

- Separately negotiated rates require per-nurse rate management tooling.
- Market-rate models require competitive intelligence infrastructure.
- A derived rate from the patient charge keeps the model simple and
  transparent.

### Rate visibility

Nurses must be able to see the payout amount for an accepted visit. The
current `nurse_payouts` record is created after visit completion. For
automation, the expected payout amount should be calculable at assignment
acceptance time.

### Future rate evolution

Post-launch, the program may evolve to:

- Per-nurse negotiated rate overrides (requires a `nurse_rate_overrides`
  table).
- Experience-based rate tiers (requires a nurse tier model).
- Surge pricing for same-day visits with low supply (requires supply/demand
  signal integration).

These are post-v1.0.0 and must be specified in a rate model amendment before
implementation.

## Referral Partner Channel Economics

### Launch model: free intake channel

At launch, referral partners submit demand at no cost and receive no referral
fee. The channel economics are:

| Direction | Flow | Launch value |
| --- | --- | --- |
| Partner → NurseConnect | Request intake | Free |
| NurseConnect → Partner | Referral fee | None |
| NurseConnect → Partner | Aggregate outcome data | Not yet (see Partner Outcomes Digest) |

This is correct for launch because:

- Partners send volume based on institutional need, not financial incentive.
- Adding a billing relationship to `domain-referral` before volume exists
  creates unnecessary complexity.
- The value proposition to partners is patient access to quality home nursing,
  not financial compensation.

### Post-launch partner economics options

The operator must decide before any partner billing implementation which model
to pursue:

| Model | Description | `domain-referral` impact |
| --- | --- | --- |
| **Free channel** | Partners submit demand at no cost; NurseConnect grows volume. | No billing relationship needed. |
| **Referral fee** | NurseConnect pays a per-completed-visit fee to the referring partner. | `domain-referral` needs a partner payout model, analogous to `nurse_payouts`. |
| **Partner subscription** | Partners pay a monthly fee for dispatch access and outcome data. | `domain-referral` needs a partner billing relationship. |
| **Tiered access** | Free basic intake; premium features (outcome data, priority routing) require subscription. | `domain-referral` needs a partner tier and billing model. |

The decision does not need to be made before M17, but it must be made before
any partner billing, partner payout, or Partner Outcomes Digest implementation
slice.

## Manual Payment Assumptions

These assumptions govern the manual private-pay period before payment
automation:

1. The admin records the patient charge amount manually when creating a
   payment authorization.
2. The admin records the nurse payout amount manually after visit completion.
3. There is no application-enforced relationship between the authorization
   amount and the payout amount.
4. The operator is responsible for applying the take rate and margin floor
   manually.
5. Payment collection and nurse disbursement happen outside the application
   (bank transfer, cash, or external invoicing).
6. The `provider` and `providerReference` fields on payment traces may be
   empty or contain operator notes during the manual period.
7. Payment traces created during the manual period are distinguished from
   automated traces by the absence of a provider reference or by a future
   `entrySource` field.

## Automation Invariants

When payment automation replaces manual operations, the automated system must
preserve these invariants:

1. **Traceability continuity.** Every payment authorization and nurse payout
   created during the manual period must remain queryable and auditable. The
   automation migration must not delete, overwrite, or reinterpret manual-era
   records.

2. **Margin enforcement.** The automated system must enforce the margin
   invariants defined above. Manual-era records that violate these invariants
   (e.g., payout exceeding charge) are accepted as historical; the automation
   must not retroactively reject them.

3. **Lifecycle compatibility.** The existing payment lifecycle state machines
   (`authorized → captured`, `authorized → voided`, `authorized → failed`,
   `owed → paid`, `owed → failed`, `owed → canceled`) must be preserved. The
   payment provider integration may add new terminal states but must not
   remove or redefine existing transitions.

4. **Currency consistency.** The automation must enforce that the
   authorization and payout for a single request use the same currency.

5. **Audit continuity.** Payment mutations recorded through the existing admin
   audit trail must continue to be logged with the same action names and
   payload shapes.

6. **Schema migration path.** The automation must add new fields (e.g.,
   `platformFeeCents`, `takeRateBasisPoints`, `entrySource`,
   `providerPaymentId`, `providerOrderId`) and a provider event ledger through
   additive migrations. Existing columns must not be renamed, removed, or have
   their types changed without a documented migration plan.

## Acceptance Criteria

- Visit pricing model (per-visit flat fee) is locked.
- Take rate model (fixed percentage with minimum floor) is locked.
- Nurse payout rate model (derived from patient charge minus platform fee) is
  locked.
- Referral partner launch economics (free intake, no referral fee) are locked.
- Manual payment assumptions are explicit.
- Automation invariants are defined and must be preserved by any future
  payment automation implementation.
- The operator has reviewed and accepted the price table values, take rate,
  and minimum platform fee before M17.

## Open Questions for Operator

These values must be set by the operator before this spec moves from Draft to
Locked:

- [ ] Patient charge for scheduled visit — standard care (cents, EUR).
- [ ] Patient charge for same-day visit — standard care (cents, EUR).
- [ ] Platform take rate (basis points, e.g., 2000 = 20%).
- [ ] Minimum platform fee (cents, EUR).
- [ ] Preferred post-launch partner economics model (free channel, referral
      fee, subscription, or tiered).
