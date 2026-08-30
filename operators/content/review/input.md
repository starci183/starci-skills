# Input

Provide the frozen teacher brief and the complete required article, image, code, and E2E bundle; declare the current and maximum review rounds and one review destination.

## Contract fields

- `context.briefRefs`: Exact frozen teacher brief used as review authority.
- `context.articleRefs`: Exact written article editions under review.
- `context.imageRefs`: Exact visual artifacts and prompt evidence, empty only when disabled.
- `context.codeRefs`: Exact implementation artifacts, empty only when disabled.
- `context.e2eEvidenceRefs`: Exact executable proof, empty only when disabled.
- `input.reviewRound`: Current independent review round.
- `input.maxReviewRounds`: Maximum authority-approved review rounds.
- `input.requiredArtifactKinds`: Artifact kinds that must exist before review can approve.
- `input.reviewTargetRef`: Bounded destination for the independent critique artifact.
