# Input

Provide frozen behavioral and test authority, exact implementation references, one command per track, a bounded repair-loop limit, and exact revision findings.

## Contract fields

- `context.behaviorContractRefs`: Exact frozen cross-track behavioral contract references.
- `context.implementationRefs`: Exact implementation artifacts allowed in the repair loop.
- `context.testAuthorityRefs`: Exact assertions that cannot be weakened by the repair loop.
- `input.mode`: Whether executable E2E proof is required, optional, or disabled.
- `input.implementationLanguages`: Zero to four implementation tracks subject to the same test contract.
- `input.commands`: Exact bounded E2E command per declared language.
- `input.maxIterations`: Maximum Luna run-read-repair iterations before blocking.
- `input.revisionFindingRefs`: Exact final-review E2E findings to repair.
