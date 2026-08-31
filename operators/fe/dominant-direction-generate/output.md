# `fe/dominant-direction-generate` output

Returns exactly one visibly rendered direction and its construction contract. There is no ranking or
user-choice wait on this path.

- `output.outcome`: Typed result consumed only by the parent Skill machine.
- `output.aiExecution`: Runtime-attested single fresh Sol brainstorm provenance.
- `output.result`: One visible dominant direction and construction contract, or null when blocked.
- `output.gaps`: Exact authority or evidence gaps.
- `output.evidenceRefs`: Exact evidence used to generate the direction.
