# F07 Queue Repair Data Lifecycle

## Scope

Administrative disposition of BASE-admitted NC-EG-08 and promotion of F07 only.
No database schema, retention, erasure, clinical write or PHI read changes.
No implementation source is included. All three ent gates remain required.

## Verification

Exact eight-file inventory; no executable, migration or schema changes. Full
selected verification uses only task-owned disposable local PostgreSQL with
synthetic CI fixtures, temporary storage and a random loopback port. No shared
database is reset or queried. Review and gate receipts exclude credentials/PHI.
