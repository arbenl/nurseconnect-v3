# Current Repo Alignment Snapshot

Date: 2026-04-24
Status: Done - captured during M15 Program Roadmap Lock
Scope: Operational repo state snapshot

## Purpose

This snapshot records the repo state during M15 without making the durable
[NurseConnect Blueprint Design](2026-04-13-nurseconnect-blueprint-design.md)
carry time-sensitive operational details.

## Current Repo Alignment

The repo has:

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
- first-hour production synthetic monitoring over the health and ops endpoints
- auth/session degradation monitoring
- a hardened launch operator console
- controlled launch execution readiness docs
- rehearsal browser hardening
- SonarCloud PR quality-gate parity as a required PR merge signal

## Remaining Ordered Work

- M16 CRM boundary design before any CRM implementation
- M17 controlled launch dry run and decision ledger before opening controlled
  intake
- M18/M19 CRM implementation only after M16 boundary approval and launch dry-run
  evidence
