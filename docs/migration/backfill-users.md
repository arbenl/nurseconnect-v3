# Identity Backfill (Phase 2.2.5)

To migrate existing users from Firebase Auth/NextAuth to the V3 Postgres domain model, we use an export-import strategy.

## 1. Export Legacy Users
Run this command against your Firebase project (or use the Firebase Console):
```bash
firebase auth:export tmp/firebase-users.json --format=json --project=nurseconnect-v2
```
Or manually place your JSON export at `tmp/firebase-users.json`.

Expected JSON format:
```json
{
  "users": [
    { "uid": "...", "email": "...", "displayName": "..." }
  ]
}
```
(Or a raw array of user objects).

## 2. Run Backfill Script

### Dry Run (Default)
Simulate the backfill and see what would happen:
```bash
pnpm tsx scripts/backfill-users.ts --input tmp/firebase-users.json
```
Check the output report (printed to stdout and saved to `tmp/backfill-users-report.*.json`).

### Apply Changes
Actually insert/update users in the Postgres database:
```bash
pnpm tsx scripts/backfill-users.ts --input tmp/firebase-users.json --apply
```

## 3. Reconciliation
Review the report artifacts in `tmp/`.
- **inserted**: New domain users created (with `firebase_uid` link).
- **updated**: Existing domain users updated with missing email/name.
- **linked**: Existing domain users linked to `firebase_uid` by email match.
- **conflicts**: Users with duplicate emails or UID mismatches (manual resolution required).

## Rollback
This script is idempotent. You can re-run it safely.
To rollback database changes, you would need to manually delete users created after a specific timestamp or restore a DB backup.
