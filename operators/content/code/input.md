# Input

Provide frozen brief, article, and behavioral-contract references; code mode; no more than four implementation languages and matching destinations; and exact revision findings.

## Contract fields

- `context.briefRefs`: Exact frozen teacher brief references.
- `context.articleRefs`: Exact explanatory article references that code must illustrate.
- `context.behaviorContractRefs`: Exact shared request, response, error, or executable behavior contracts.
- `input.mode`: Whether implementation code is required, optional, or disabled.
- `input.implementationLanguages`: Zero to four implementation languages sharing the same behavior.
- `input.trackTargetRefs`: One bounded destination reference per requested implementation language.
- `input.revisionFindingRefs`: Exact final-review code findings to repair.
