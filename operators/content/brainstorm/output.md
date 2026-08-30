# Output

Return a frozen teacher brief with learner inputs, observable learner outputs, required examples, interview outcomes, add/change/remove dispositions, evidence, and one fresh Sol execution receipt.

## Contract fields

- `output.outcome`: Typed result consumed by the content Skill.
- `output.aiExecution`: Runtime-attested single fresh Sol teacher execution.
- `output.briefRef`: Frozen inspectable lesson brief, or null when blocked.
- `output.learnerInputRefs`: Exact prerequisites and assumed learner-input references.
- `output.learnerOutputRefs`: Observable learner-output references used for assessment.
- `output.exampleRefs`: Required happy, edge, failure, and contrast example references.
- `output.interviewOutcomeRefs`: Required interview questions, follow-ups, and answer-quality references.
- `output.dispositions`: Explicit add, change, and remove decisions for this content unit.
- `output.evidenceRefs`: Exact evidence supporting the teacher brief.
- `output.reason`: Bounded blocker reason, otherwise null.
