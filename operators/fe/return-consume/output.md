# `fe/return-consume` output

- `output.outcome`: Typed result routed by the Skill machine.
- `output.result`: Atomic result.
- `output.gaps`: Exact blockers.
- `output.evidenceRefs`: Evidence consumed.

`consumed` requires a structured result, no gaps, and exact receipt evidence. `blocked` requires a
null result and at least one exact correlation gap.
