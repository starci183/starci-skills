# `fe/mutation-boundary-freeze` input

## Context

- `context.verifiedFrontendRoute`: Verified FE route.
- `context.approvedContractFingerprint`: Approved contract fingerprint.

## Input

- `input.intent`: Mission intent.
- `input.uxUiChangeLevel`: Projection of the frozen `frontend.ux-ui.change-level` scope dimension enforced by the file boundary.
- `input.layoutOwnerCeilingMode`: Projection of the frozen `frontend.layout.owner-ceiling` dimension.
- `input.layoutOwnerCeiling`: Target owner, feature-owned/directly nested page-modal-drawer owners, mutable nested layouts, explicitly authorized mutable ancestors, and immutable/excluded owners projected from frozen frontend scope.
- `input.mutationAuthorizationRef`: Explicit mutation authorization, nullable only for non-mutating outcomes.
- `input.files`: Exact files, before hashes, and owner refs; every owner must be mutable under `layoutOwnerCeiling`.
- `input.dominance`: Whether authority proves one uniquely dominant mutation.
