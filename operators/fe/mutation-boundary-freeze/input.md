# `fe/mutation-boundary-freeze` input

## Context

- `context.verifiedFrontendRoute`: Verified FE route.
- `context.approvedContractFingerprint`: Approved contract fingerprint.

## Input

- `input.intent`: Mission intent.
- `input.uxUiChangeLevel`: Projection of the frozen `frontend.ux-ui.change-level` scope dimension enforced by the file boundary.
- `input.mutationAuthorizationRef`: Explicit mutation authorization, nullable only for non-mutating outcomes.
- `input.files`: Exact files and before hashes.
- `input.dominance`: Whether authority proves one uniquely dominant mutation.
