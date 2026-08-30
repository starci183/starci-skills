# Output

Return one build-checked result per language, the shared contract, exact evidence, and Luna execution provenance; or a typed not-needed/blocked result.

## Contract fields

- `output.outcome`: Typed implementation result consumed by the content Skill.
- `output.aiExecution`: Runtime-attested Luna implementation execution, or null when code is disabled.
- `output.trackResults`: One implementation result for every requested programming-language track.
- `output.contractRef`: Exact shared behavioral contract implemented by all tracks, or null when disabled.
- `output.evidenceRefs`: Exact source and build evidence references.
- `output.reason`: Bounded blocker or not-needed reason, otherwise null.
