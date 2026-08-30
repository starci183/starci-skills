# `fe/design-critique` output

- `output.outcome`: Legacy semantic result consumed only by the Skill machine.
- `output.result`: The atomic job result, or null when blocked.
- `output.gaps`: Exact missing authority or evidence; empty when complete.
- `output.evidenceRefs`: Exact evidence used to produce the result.

## Contract fields

- `output.aiExecution`: Runtime-attested single fresh Sol execution provenance.
