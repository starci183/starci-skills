# `fe/source-repair` output

- `output.outcome`: Typed result routed only by the parent Skill machine.
- `output.result`: This operator atomic product, or null when incomplete.
- `output.gaps`: Exact blockers or authority gaps.
- `output.evidenceRefs`: Exact evidence used.
- `output.handoff`: Typed cross-domain continuation, only when the outcome requires it.

`authorization-required` returns null result plus the exact above-ceiling owner/file gap; the parent
routes `mutation-choice` and resumes after an explicit authorization receipt instead of terminating
the audit as blocked.
