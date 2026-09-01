# `fe/capture-preflight` output

- `output.outcome`: Typed preflight classification consumed only by the parent Skill.
- `output.result`: Frozen preflight product, or null when preflight cannot become ready.
- `output.gaps`: Exact deterministic failures or authority gaps.
- `output.evidenceRefs`: Exact evidence used by the readiness decision.
- `output.handoff`: Typed backend handoff only when backend-owned readiness is missing.

Every outcome requires deterministic evidence. `ready` and `source-repair` keep `handoff` null;
`backend-required` carries exactly one backend handoff; `blocked` carries no handoff. Every non-ready
outcome has a null result and exact gaps.

A backend handoff repeats the invocation's exact `capture-preflight` or `recapture-preflight` state;
it never rewinds to apply or loses whether this is the bounded recapture.

Return `ready` only when every deterministic readiness check passes, every check evidence ref is
registered, the `preflightRef` is registered as an artifact, and the matrix/partition contract is
frozen against the exact compiled-request identity and registered source-apply RETURN plus aggregate
after fingerprint. `source-repair`, `backend-required`, and `blocked` are emitted before any Sol visual-review
token is spent; this operator never invokes the repair or cross-domain continuation itself.
