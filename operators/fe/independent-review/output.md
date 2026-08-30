# `fe/independent-review` output

- `output.outcome`: Typed result routed only by the parent Skill machine.
- `output.result`: This operator atomic product, or null when incomplete.
- `output.result.reviewerExecutionRef`: Distinct execution identity that authored the verdict.
- `output.result.inspectionRefs`: Exact per-image inspection records independently reviewed.
- `output.result.inspectionVerdicts`: Structured independent verdict for every inspection reference.
- `output.result.probeVerdicts`: Structured independent verdict for all ten adversarial categories.
- `output.gaps`: Exact blockers or authority gaps.
- `output.evidenceRefs`: Exact evidence used.
- `output.handoff`: Typed cross-domain continuation, only when the outcome requires it.

## Contract fields

- `output.aiExecution`: Runtime-attested single fresh Sol execution provenance.
