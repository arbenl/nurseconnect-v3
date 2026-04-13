# Canonical Portal Routing Design

**Date:** 2026-04-13

**Goal:** Align NurseConnect's auth and portal routing with the stronger Interdomestik pattern so route ownership is centralized, role landing pages are explicit, and protected trees no longer rely on scattered hardcoded redirects.

## Problem

NurseConnect currently spreads portal routing across edge middleware, auth UI, onboarding UI, and server layouts. That creates drift:

- Login sends every user to `/dashboard`.
- Onboarding completion sends every user to `/dashboard`.
- `/dashboard` and `/admin` use independent protection logic.
- Admin users can be routed through the generic app tree before landing in the correct portal.

## Design

Introduce a small canonical routing layer for NurseConnect roles:

- `patient` -> `/dashboard`
- `nurse` -> `/dashboard`
- `admin` -> `/admin`

Use that layer in three places:

1. A shared route helper in `apps/web/src/lib/canonical-routes.ts`.
2. A shared edge boundary module in `apps/web/src/lib/proxy-logic.ts`, with `middleware.ts` reduced to a thin wrapper.
3. Server and client redirect points:
   - login success
   - onboarding completion
   - `/dashboard` app layout
   - `/admin` layout

## Expected Behavior

- Anonymous access to `/dashboard` and `/admin` still redirects to `/login`.
- Authenticated admin access to `/dashboard` redirects to `/admin`.
- Authenticated patient or nurse access to `/admin` redirects to `/dashboard`.
- Login and onboarding use the same canonical destination logic instead of hardcoded route strings.

## Testing

- Unit tests for the canonical route helper.
- UI E2E coverage for admin login landing in `/admin`.
- Existing smoke tests remain the guard for anonymous protected-route redirects.
