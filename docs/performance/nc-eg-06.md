# NC-EG-06 Performance

## Scope

Special promotion validation adds bounded tracker parsing, JSON parsing, set
comparison, and one additional local git changed-file enumeration. It performs
no network request and does not affect application runtime.

## Verification

The ent-gate test suite exercises both special modes. Inputs are bounded by the
repository tracker and changed-file list, so no separate runtime budget is
required.
