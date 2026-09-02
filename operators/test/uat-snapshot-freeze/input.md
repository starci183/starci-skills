# `test/uat-snapshot-freeze` input

## Context

- `context.backendSourceRef`: Verified backend Source owning canonical UAT authority.
- `context.authorityRefs`: Frozen business, source, runtime, and lens authority.
- `context.sourceFingerprint`: Exact immutable source inherited from Quality PASS.

## Input

- `input.feature`: Canonical feature key.
- `input.flow`: Canonical flow key.
- `input.account`: Non-secret record returned after the Control Panel automatically creates the fresh
  UAT identity in Keycloak and the application database and broker-authenticates it. Passwords,
  cookies, tokens, and OTPs are forbidden.
