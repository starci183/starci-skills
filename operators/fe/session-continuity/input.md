# `fe/session-continuity` input

Consumes only opaque lease/account/context fingerprints and the exact continuity failure. Raw
credentials, cookies, tokens, and OTPs are forbidden.

- `context.missionRef`: Canonical frontend mission identity.
- `context.runtimeGeneration`: Central runtime generation expected by the lease.
- `context.origin`: Canonical local frontend origin.
- `input.leaseRef`: Opaque failed or stale Browser lease identity.
- `input.accountRef`: Fresh mission-scoped logical UAT account reference.
- `input.browserContextRef`: Isolated Browser context bound to the lease.
- `input.principalFingerprint`: Opaque authenticated principal identity.
- `input.continuityFailure`: Observed reason the existing lease cannot be trusted.
