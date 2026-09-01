# `fe/authority-reconcile` input

## Context

- `context.evidenceRefs`: Exact canonical evidence references available to this atomic job.
- `context.authorityRevision`: Exact approved authority revision binding this invocation.

## Input

- `input.targetRef`: The one target owned by this atomic invocation.
- `input.constraints`: Closed constraints that bound this job without routing it.
- `input.gapRef`: Exact compile-time Grammar gap being repaired.
- `input.owner`: Always `grammar`.
- `input.authorityRef`: Exact routed `grammar://` owner allowed to change.
- `input.authorityBoundary`: Exact Grammar file paths, owners, and before hashes authorized for repair.
- `input.authorityBoundaryFingerprint`: Immutable fingerprint of that ordered Grammar boundary.
