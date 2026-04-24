# NurseConnect Blueprint Design

Date: 2026-04-13
Status: Canonical product blueprint

## Purpose

This document is the durable repo version of the NurseConnect blueprint that
governs product direction for the v1.0.0 launch program.

The Notion mirror is `2026-04-13 NurseConnect Blueprint Design` under the
NurseConnect Program page.

## Thesis

NurseConnect is a managed care-dispatch marketplace for low-acuity in-home
nursing.

It is not a generic gig marketplace. The governing rules are:

- NurseConnect owns the customer relationship and dispatches care.
- Demand is referral-led first, with consumer demand secondary.
- Supply is licensed, verified nurse capacity only.
- Launch is scheduled-first, with same-day simple visits only when nearby
  verified supply exists.
- Expansion is city by city, with density before coverage.

## Core Business Model

### Demand

- Primary channel: doctors, clinics, discharge planners, and referral partners.
- Secondary channel: direct household requests.
- Launch payer: private pay by patient or family.

### Supply

- Contractors first at launch.
- No nurse becomes dispatchable without verification.
- License validity period and compliance state determine supply eligibility.

### Care Wedge

- Scheduled post-discharge and chronic-support home visits first.
- Same-day simple visits only as a fast lane when nearby nurse capacity exists.
- Non-emergency, low-acuity, repeatable visit types only at launch.

## Product Layers

1. Demand layer: request intake, patient context, referral source, and timing
   preferences.
2. Trust layer: credential submission, verification, expiry, suspension, and
   renewal.
3. Dispatch layer: matching, accept/reject, enroute, completion, reassignment,
   and events.
4. Control layer: triage queue, audit trail, reliability, exceptions, service
   governance, launch monitoring, and operator response.

## Launch User Surfaces

- Patient / family.
- Referral partner.
- Nurse.
- Admin / ops.

## What Must Exist Early

- Credential verification and expiry enforcement.
- Unified scheduled and same-day request model.
- Admin ops desk with triage, reassignment, audit visibility, exception queue,
  and machine-readable ops status.
- Private-pay charging and payout traceability.
- Referral intake that is as real as consumer intake.
- Active service-area controls for launch geography.
- Launch rehearsal and monitoring workflows that make operational risk visible
  before and during launch.

## What Should Wait

- Broad urgent-care positioning.
- Reimbursement complexity before private-pay works.
- White-label partner branding.
- Broad care-management sprawl beyond dispatch core.
- Public status page.
- Geographic expansion before local density is proven.

## Current Repo Alignment Snapshot After M8

The repo now has:

- enforced nurse credential review and verified-supply gating
- canonical auth/portal boundary control
- scheduled vs same-day request intake fields
- referral partner actor, portal, intake, and partner-scoped visibility
- explicit triage and exception workflows
- private-pay authorization and payout traceability
- service-area controls, intake gating, dispatch scoping, and nurse location
  tagging
- launch readiness runbooks, rehearsal seed, automated API rehearsal, full
  browser rehearsal, composite health, admin ops status, and failed
  payment/payout alert hook

The repo still needs:

- first-hour production synthetic monitoring over the M8 endpoints
- auth/session degradation monitoring
- operator-console hardening based on the launch monitoring signals

## Success Gates

- At least 10 verified nurses in the launch city.
- At least 80% of in-scope same-day requests receive an assignment decision
  within 30 minutes.
- Credential review turnaround is at most 2 business days.
- At least 90% of accepted assignments reach completed-visit status.
- Unfulfilled and out-of-scope requests are explicitly classified.
- Composite health stays green during first-hour launch monitoring.
- Admin ops status shows active service area and verified available nurse
  supply before intake opens.
