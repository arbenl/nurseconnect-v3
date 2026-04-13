# NurseConnect Blueprint

**Date:** 2026-04-13

**Goal:** Define the business, operating, and product blueprint for NurseConnect so the repo can evolve toward a coherent company model instead of a loose dispatch MVP.

## Thesis

NurseConnect should be built as a managed care-dispatch marketplace for low-acuity home nursing.

It is not a generic "Uber for nurses." It is a regulated marketplace with a hard trust gate:

- NurseConnect owns the customer relationship and dispatches care.
- Demand is referral-led first, with direct consumer demand as a secondary lane.
- Supply is licensed, verified nurse capacity, not open self-serve onboarding.
- The launch wedge is scheduled-first home visits, with same-day simple visits as an opportunistic fast lane.
- Launch should be city by city, with density before coverage.

## Problem

The current repo has a dispatch core, but it does not yet have a canonical product blueprint.

That creates drift:

- business intent lives partly in README copy, partly in launch hardening docs, and partly in code behavior
- nurse self-serve flows still conflict with the intended licensed-and-verified supply model
- the product promise is broader than the current operational shape
- the repo lacks a single target model that can guide architecture, roadmap, and scope decisions

This blueprint defines that target model.

## Business Model

NurseConnect is a managed marketplace that connects households and referral partners to verified local nurses for in-home care visits.

### Demand

- **Primary channel:** referral-led demand from doctors, clinics, and discharge planners
- **Secondary channel:** direct consumer demand from patients and families
- **Primary payer at launch:** patient or family, private-pay per visit

Referral-led demand should be the main growth engine in the first year because it is denser, more trusted, and more predictable than pure consumer acquisition. Direct consumer demand still matters, but it should support utilization and brand pull rather than define the whole go-to-market motion.

### Supply

- **Launch supply model:** contractors first
- **Longer-term option:** mixed contractor and managed supply
- **Hard rule:** no nurse enters dispatchable supply without license verification

Supply is not created by role conversion. A nurse becomes eligible only after NurseConnect captures license information, records the validity period, and verifies the credential.

### Care Wedge

- **Primary wedge:** scheduled post-discharge and chronic-support home visits
- **Secondary fast lane:** same-day simple visits when a verified nurse is nearby and available
- **Launch scope:** non-emergency, low-acuity, repeatable visit types only

## Operating Model

NurseConnect should run one unified request system that supports both scheduled and same-day visits.

### Core Operating Loop

1. A referral partner or household submits a request.
2. NurseConnect triages the request for serviceability, acuity, and geography.
3. The system routes the request to verified, non-expired, available nurse supply.
4. The nurse accepts, travels, performs the visit, and updates status.
5. The visit closes with service confirmation, payment completion, and an auditable event trail.
6. Follow-up and repeat visits feed retention and referral trust.

### Supply Operations

Supply operations need a first-class compliance workflow:

- nurse application or onboarding record
- license number, jurisdiction, and validity period
- verification decision
- suspension and renewal handling
- automatic removal from dispatch eligibility when credentials expire or fail review

Nurses may manage operational data such as availability or location, but they do not control credential truth.

### Demand Operations

Demand operations should treat referral and consumer intake as two entry points into the same service system:

- one request model
- one triage model
- one dispatch model
- one visit lifecycle

Cases outside launch scope should be declined or redirected rather than forced through the network.

### Control Layer

NurseConnect needs an operations desk, not just automated matching.

Admins and ops staff must be able to:

- verify nurse credentials
- review and triage requests
- reassign visits
- observe lifecycle events end to end
- monitor supply reliability and exceptions

## Product Blueprint

The product should converge around four layers.

### 1. Demand Layer

This layer owns request intake and patient context:

- patient and household profiles
- referral source capture
- address and timing preferences
- care-request creation
- repeat-visit intent

### 2. Trust Layer

This layer owns nurse credentialing:

- license submission
- document handling
- expiry tracking
- verification
- suspension
- renewal
- supply activation and deactivation

### 3. Dispatch Layer

This layer owns service execution:

- scheduling
- same-day matching
- accept or reject
- enroute
- completion
- reassignment
- request and visit events

### 4. Control Layer

This layer owns operational visibility and quality:

- admin queue
- exception handling
- audit trail
- partner visibility
- nurse reliability signals
- service governance

### Launch User Surfaces

The launch product should support four user surfaces:

- **Patient / family:** request care, view status, confirm visits, manage repeat care
- **Referral partner:** submit requests, track progress, receive visibility into outcomes
- **Nurse:** manage profile, submit license documents, set availability and location, handle assigned visits
- **Admin / ops:** verify nurses, triage requests, reassign work, review audit and quality signals

### Product Rules

The product must preserve three rules:

1. No nurse enters supply without verification.
2. Scheduled and same-day visits share one request system.
3. Ops has full event visibility across the service lifecycle.

## Repo Implications

The repo should evolve toward five product domains:

1. **Intake and patient context**
2. **Nurse credentialing**
3. **Dispatch and visits**
4. **Ops and quality**
5. **Revenue and settlement**

That means the repo should stop treating nurse activation as a simple role toggle and start modeling supply eligibility as a separate domain with its own workflows and controls.

## Roadmap

### Phase 1: Launch Wedge

Launch in one city with:

- verified licensed nurse supply
- referral-led demand
- private-pay visits
- scheduled-first requests
- same-day simple visits only when nearby supply exists

### Phase 2: Density and Repeatability

Strengthen the local operating loop:

- repeat visits
- partner referral workflows
- nurse reliability scoring
- compliance renewal automation
- city-level service metrics

### Phase 3: Multi-City Expansion

Replicate the model city by city without weakening verification, reliability, or response-time standards.

### Phase 4: Broader Commercial Surface

Only after the core loop is stable should NurseConnect expand into:

- richer partner tooling
- broader care programs
- deeper settlement or reimbursement paths
- more advanced network operations

## What Must Exist Early

- credential verification and expiry enforcement
- unified scheduled and same-day request model
- admin ops desk with triage, reassignment, and audit visibility
- private-pay charging and payout traceability
- referral intake that is as real as consumer intake

## What Should Wait

- open-ended urgent-care positioning
- broad reimbursement complexity before private-pay works
- white-label or partner-branded modes
- broad care-management sprawl beyond the dispatch core
- geographic expansion before local density is proven

## End-State

If executed well, NurseConnect becomes a dispatch-centric in-home nursing network with:

- trusted local verified supply in each market
- a referral plus consumer demand flywheel
- a consistent operating model for low-acuity home nursing access

The company should expand by deepening the trust-and-dispatch core, not by piling unrelated features on top of an unstable service model.
