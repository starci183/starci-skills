# `test/uat-case-freeze` input

## Context

- `context.snapshotRef`: Frozen canonical snapshot.

## Input

- `input.evidenceRefs`: Exact browser, account, behavior, UX, or UI evidence.
- `input.browserSessionRef`: Exact visible-browser session.
- `input.sessionLease`: Opaque mission/account/context/runtime-generation binding reused across visual rounds; never contains credentials, cookies, or OTPs.
- `input.accountRef`: Fresh isolated account or explicit anonymous identity.
