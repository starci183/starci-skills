# `fe/capture-preflight` output

- `output.outcome`: Typed preflight routing result.
- `output.result`: Frozen preflight product, or null when preflight cannot become ready.
- `output.result.dataEvidence`: Exact live or contract-fixture evidence mode propagated through capture and visual routing. Fixture mode includes the consumed backend `prove` RETURN receipt.
- `output.gaps`: Exact deterministic failures or authority gaps.
- `output.evidenceRefs`: Exact evidence used by the readiness decision.
- `output.handoff`: Typed backend handoff only when backend-owned readiness is missing.

Return `ready` only when every deterministic readiness check passes and the matrix/partition contract is frozen. Missing backend-owned data first returns `backend-required` with `intentMode=prove`. Only after that Backend Skill RETURN is consumed may a valid contract fixture return `ready` for visual proof while retaining its backend gap; that gap must route a later visual PASS to `backend-required`, never quality/UAT. Runtime/worktree/capture harness failures return `blocked` and product implementation defects return `source-repair`, all before any Sol visual-review token is spent.
