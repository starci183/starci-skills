# `fe/authority-reconcile` input

## Context

- `context.evidenceRefs`: Exact canonical evidence references available to this atomic job.
- `context.authorityRevision`: Exact approved authority revision binding this invocation.

## Input

- `input.targetRef`: The one target owned by this atomic invocation.
- `input.constraints`: Closed constraints that bound this job without routing it.
- `input.findingRef`: Exact classified visual finding whose reusable authority owner is being reconciled.
- `input.owner`: The proven authority owner: `grammar` or `ui-knowledge`.
- `input.authorityRef`: Exact routed Grammar or shared UI-knowledge record allowed to change.
