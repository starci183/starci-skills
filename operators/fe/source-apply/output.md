# `fe/source-apply` output

- `output.outcome`: Typed result routed only by the parent Skill machine.
- `output.result`: This operator atomic product, or null when incomplete.
- `output.gaps`: Exact blockers or authority gaps.
- `output.evidenceRefs`: Exact evidence used.
- `output.handoff`: Typed cross-domain continuation, only when the outcome requires it.

`applied` repeats the mode, compiled request ref/fingerprint, Grammar identity, proof matrix,
direction mode/binding, target, behavior-contract
binding, source-boundary files/before hashes,
and exact mutation effect records. Artifact refs must equal changed paths, remain inside the repeated
boundary, and prove a real created/updated/deleted before-to-after transition. Its
`aggregateAfterFingerprint` hashes the exact ordered effect paths and after hashes for runtime receipt
binding. It also requires exact
mutation evidence, no gaps, and no handoff. The parent must compare every repeated binding with the
invocation before accepting the receipt.

The compiled request and selected direction refs must appear in evidence. `backend-required`
requires a null result, exact evidence/gaps, and one backend handoff whose
`resumeState` exactly repeats the invocation's `context.resumeState`. `blocked`
requires a null result, exact evidence/gaps, and no handoff. Green tests, prose, or an artifact outside
the frozen boundary cannot substitute for effect evidence.
