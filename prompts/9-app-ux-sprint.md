# Phase: App UX Sprint (Early-Stage)

## Objective
Improve core in-app experience quality and delivery speed for NurseConnect V3 without breaking safety or release gates.

## Scope
- Patient dashboard clarity:
  - Primary CTA hierarchy
  - Current request card readability
  - Status chip/timeline visibility
  - Empty/loading/error states
- Nurse dashboard clarity:
  - Availability status clarity
  - Current assignment clarity
  - Next best action guidance
- Onboarding to dashboard handoff:
  - Remove flicker/loop regressions
  - Keep redirect behavior deterministic
- UX consistency:
  - Toasts and feedback consistency
  - Accessible labels and state messaging

## Non-Scope
- New billing/payments
- New role model or auth provider changes
- Large visual redesign outside dashboard/onboarding/request states

## Required Output
- Minimal, high-leverage change set with clear acceptance criteria.
- Explicit risk notes for security/ops implications.
- Verification plan mapped to existing CI lanes.
- Release notes block for product/support teams (what changed, user impact, rollback note).

## Pro Delivery Bar
- Accessibility baseline:
  - Keyboard-only navigation for all updated dashboard controls.
  - Screen-reader labels for status, CTA, and assignment state.
  - No color-only status communication.
- Reliability baseline:
  - Deterministic loading/empty/error rendering per state.
  - No infinite redirect or repeated mount/unmount loops in onboarding->dashboard flow.
- UX quality baseline:
  - Primary action remains visible on mobile and desktop.
  - State transitions provide immediate feedback (loading + completion/error).
- Healthcare safety baseline:
  - No PHI values in client logs/toasts/error text.
  - No secrets/tokens exposed in UI or console output.

## Verification Evidence Required
- List exact commands run and pass/fail output summary.
- Include before/after behavior notes for:
  - patient request creation + status visibility
  - nurse availability + assignment visibility
  - onboarding redirect stability
- Identify any residual risks with mitigation/owner.

## Exit Criteria
- No dashboard/onboarding flicker in happy path.
- Patient can create and view a request status confidently.
- Nurse can see assignment and availability status confidently.
- `pnpm gate:release` remains green.
