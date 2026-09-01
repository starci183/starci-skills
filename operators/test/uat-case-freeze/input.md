# `test/uat-case-freeze` input

## Context

- `context.snapshotRef`: Frozen canonical snapshot.
- `context.snapshotReturnReceiptRef`: Exact validated snapshot-freeze RETURN.
- `context.sourceFingerprint`: Exact source inherited from the frozen snapshot.
- `context.missionRef`: Trusted mission identity; must exactly equal both the lease mission and the
  owning runtime receipt mission.
- `context.runtimeOwner`: Exact current ready owner artifact for a project-bound runtime. Legacy
  StarCi Academy `3000/3001/8080` inputs may omit it.

## Input

- `input.evidenceRefs`: Exact browser, account, behavior, UX, or UI evidence.
- `input.browserSessionRef`: Exact visible-browser session.
- `input.sessionLease`: Opaque authenticated, unexpired mission/account/context/runtime-generation
  binding reused across visual rounds. For a project-bound runtime it carries the exact project,
  application, owner, and endpoint-authority fingerprint and its origin equals the owner FE origin;
  it never contains credentials, cookies, or OTPs.
- `input.accountRef`: Fresh isolated account or explicit anonymous identity.
