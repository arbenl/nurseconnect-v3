cat > CONTRIBUTING.md <<'MD'
# Contributing & Local Dev Guide

This doc is your quick-reference for running type checks, tests, and emulators in **nurseconnect-v3**. Follow these steps after small code edits to avoid accidental runtime errors.

---

## Repo map & daily commands

| Path | What lives here | When you touch it… | Run these fast checks | Notes |
|---|---|---|---|---|
| `apps/web` | Next.js app, routes, UI, middleware, NextAuth | UI component, page, hook, middleware, API route | ```bash\npnpm -F web type-check\npnpm test:web\npnpm -F web lint\n``` | `test:web` = Vitest (jsdom) via `apps/web/vitest.config.ts`. No emulators. |
| `packages/contracts` | Shared types & Zod schemas; emulator tests live under `test/emu` | Edited a schema or contracts logic | ```bash\npnpm test:contracts\n``` | Node env tests via `packages/contracts/vitest.config.ts`. |
| `packages/contracts/test/emu` | **Emulator tests** (Auth/Firestore behavior, rules) | Changed Firestore rules or anything governed by permissions | **Ephemeral run:** ```bash\npnpm dlx firebase-tools emulators:exec --only auth,firestore --project demo-nurseconnect "pnpm test:emu"```\n**Manual run:** start emulators then `pnpm test:emu` | Uses `packages/contracts/vitest.config.emu.ts`. Keep PRs fast—run on demand. |
| `packages/ui` | Shared UI primitives (if used) | Changed a utility/component | ```bash\npnpm -F ui type-check\n``` | Add tests here when needed. |
| `apps/functions` | Cloud Functions (if present) | Type changes | ```bash\npnpm -F functions type-check\n``` | Add runtime tests later if needed. |

---

## What to run after **small changes (atomic)**

| You changed… | Minimal test set | Extra safety | Command(s) |
|---|---|---|---|
| React component (`apps/web/src/components/...`) | Web unit tests + types + lint | Run only the file you touched | ```bash\npnpm -F web type-check\npnpm test:web\n# only this spec\npnpm -F web vitest run src/components/__tests__/role-badge.test.tsx\npnpm -F web lint\n``` |
| Page or API route (`apps/web/src/app/**`) | Web unit tests + types + lint | If it relies on Firestore/permissions, also run emulator tests | ```bash\npnpm -F web type-check\npnpm test:web\n# permissions-sensitive changes\npnpm dlx firebase-tools emulators:exec --only auth,firestore --project demo-nurseconnect "pnpm test:emu"\n``` |
| Middleware (`apps/web/src/middleware.ts`) | Targeted middleware spec + web suite | — | ```bash\npnpm -F web type-check\npnpm -w vitest run apps/web/src/middleware.test.ts\npnpm test:web\n``` |
| Zod schema (`packages/contracts/src/**`) | Contracts unit tests | Web type-check if imported in app | ```bash\npnpm test:contracts\npnpm -F web type-check\n``` |
| Firestore rules (`firestore.rules`) | Emulator tests | Repeat after tweaks | ```bash\npnpm dlx firebase-tools emulators:exec --only auth,firestore --project demo-nurseconnect "pnpm test:emu"\n``` |
| Auth/Firestore client util (`apps/web/src/lib/firebase/**`) | Web unit tests | Emulator tests if behavior depends on rules | ```bash\npnpm -F web type-check\npnpm test:web\n# optional, if permissions matter\npnpm dlx firebase-tools emulators:exec --only auth,firestore --project demo-nurseconnect "pnpm test:emu"\n``` |
| Shared UI package (`packages/ui`) | Type-check UI | Web tests if web consumes it | ```bash\npnpm -F ui type-check\npnpm -F web type-check\npnpm test:web\n``` |

---

## Full pre-commit sanity (fast)

```bash
pnpm type-check           # turbo type-check across packages
pnpm test:ci              # web + contracts unit tests (no emulators)
pnpm -F web lint