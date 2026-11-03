# NurseConnect Sentry Gate

The approved target is `config/nurseconnect-sentry-target.json`: Sentry HTTPS
origin, NurseConnect org/project slugs and both immutable IDs. No DSN or credential
belongs in that file. The advisory and trusted collector share one bounded client.

## Runtime Configuration

- `NURSECONNECT_SENTRY_AUTH_TOKEN` is preferred. The existing `SENTRY_AUTH_TOKEN`
  can be used when no dedicated token is available; metadata verification is
  required before querying issues. Authentication failure never falls back.
- Optional `NURSECONNECT_SENTRY_ORG`, `NURSECONNECT_SENTRY_PROJECT` and
  `NURSECONNECT_SENTRY_BASE_URL` must exactly match the pin. They cannot retarget it.
- Generic `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_BASE_URL` never select the
  destination. Outside CI, mismatches are ignored with a key-only diagnostic.
  For env-driven CLI calls, CI true/TRUE/1 makes mismatches or advisory overrides
  fail before any request. Programmatic callers that supply a token must also pass
  the environment whose drift policy should be enforced.
- Credentials must enter only through the existing runtime secret mechanism.
  Never paste them into chat, evidence, commands or reviewer packets.

## Strict Verification

Run `pnpm sentry:advisory -- --run-root tmp/multi-agent/nc-sentry-check --strict`
in the authorized NurseConnect environment. Do not source another repo's env.
An empty valid issue list passes. Nonempty lists fail strict verification.
Missing/blank credentials, identity mismatch, redirects, 401/403, timeout and
invalid/oversized responses fail. Non-strict missing-config output is diagnostic
only and cannot stand in for mandatory strict live evidence.

`evidence/sentry/sentry-unresolved.json` now contains only schemaVersion, status,
checkedAt, pinned identity and unresolvedSampleCount; it is no longer an issue
array. Markdown and CLI output never include issue payloads or provider errors.
Do not add issue titles/bodies to troubleshooting evidence.

## Failure And Rollback

For FORBIDDEN_CONFIG, compare only the named nonsecret NC settings to the pin.
For identity/auth/transport failures, keep the gate failed and correct the exact
NurseConnect setting or existing credential; never query a foreign target, lower
the threshold or set advisory mode in CI. Roll back only this slice through a
reviewed change; preserve tenant holds and unrelated worktrees.

The existing project-issues route is deprecated; any endpoint migration remains
separate, reviewed work. Provider API reference:
[project metadata](https://docs.sentry.io/api/projects/retrieve-a-project/) and
[project issue list](https://docs.sentry.io/api/events/list-a-projects-issues/).
