# `fe/capture-preflight` output

- `output.outcome`: Typed preflight routing result.
- `output.result`: Frozen preflight product, or null when preflight cannot become ready.
- `output.gaps`: Exact deterministic failures or authority gaps.
- `output.evidenceRefs`: Exact evidence used by the readiness decision.
- `output.handoff`: Typed backend handoff only when backend-owned readiness is missing.

Return `ready` only when every deterministic readiness check passes and the matrix/partition contract is frozen. Return `source-repair`, `backend-required`, or `blocked` before any Sol visual-review token is spent.
