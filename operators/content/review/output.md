# Output

Return one fresh Sol verdict, hard quality scores, evidence-bound findings assigned to one owning stage, approved artifact references only on approval, and exact review evidence.

## Contract fields

- `output.outcome`: Typed verdict and precise revision owner consumed by the content Skill.
- `output.aiExecution`: Runtime-attested single fresh Sol independent review execution.
- `output.reviewRef`: Inspectible adversarial review artifact, or null when blocked before review.
- `output.scores`: Hard output scores for correctness, pedagogy, interview value, language, visual fidelity, code quality, and E2E proof.
- `output.findings`: Actionable critique items assigned to one owning stage and exact evidence.
- `output.approvedArtifactRefs`: Exact final bundle references, empty unless approved.
- `output.evidenceRefs`: Exact review and inspected-bundle evidence.
- `output.reason`: Bounded blocker reason, otherwise null.
