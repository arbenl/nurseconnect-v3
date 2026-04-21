# M7: Full Milestone Browser Rehearsal Design

## Purpose
A single, continuous end-to-end browser rehearsal designed to prove the core milestones (M1-M6) work together as one cohesive operational path. This is a launch readiness tool, not a generic regression suite. It verifies continuity across actor roles (Partner, Admin, Nurse) and request state.

## Architecture & Execution Strategy

### 1. Monolithic Continuity (Fail-Fast)
We use a single monolithic Playwright test using `test.step()` blocks for each milestone.
- **Rationale**: If M1 setup or M2 triage breaks, later milestone assertions are invalidated. A fail-fast monolithic run perfectly simulates a real request lifecycle.
- **Traceability**: Each milestone is wrapped in a `test.step()` to provide granular visibility in the Playwright HTML report without sacrificing continuity.

### 2. Deterministic Setup via Fixtures
While the rehearsal drives the UI, the baseline state is strictly deterministic.
- **Implementation**: Playwright fixtures (or API/DB helpers) will silently provision the required baseline data before the visible browser journey begins.
- **Provisioned State**: Baseline actors (Verified Nurse, Partner, Admin, Patient) and geofenced Service Area.

### 3. Continuous Browser Journey
Once the baseline state is seeded, the Playwright browser is driven entirely through the UI (`/login`, `/dashboard`, `/partner`, `/admin/*`).
- **Resilience**: Avoid arbitrary `waitForTimeout` calls. Use `waitForResponse()` for critical API boundaries and strict Role/Heading assertions for visual states.

## Rehearsal Flow (The Steps)

1. **M0/M5/M6: Readiness Preconditions**
   - Execute baseline readiness scripts (`pnpm launch:readiness`).
2. **M4: Service Areas**
   - Admin validates service area visibility and verifies in-area demand gating.
3. **M1: Referral Partner**
   - Partner logs in, creates a partner request, and views it.
4. **M2: Exception Triage**
   - Admin navigates to the exception queue, opens the detail view, and triages/reopens the request.
5. **M3: Payment & Payout Trace**
   - Admin traces the payment and payout state. (API fallback is acceptable only if the UI lacks write controls).
6. **Final: Admin Evidence**
   - Admin verifies that the final evidence surfaces correctly on the request detail page.

## Artifacts & Reporting
- Captures standard Playwright screenshots, traces, and video upon failure.
- Provides a clean `test.step` breakdown for CI visibility.
