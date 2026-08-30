# Output

Return the unchanged contract fingerprint, Luna loop provenance, iteration count, deterministic per-track commands/assertions/exit codes, evidence, and typed outcome.

## Contract fields

- `output.outcome`: Typed executable-proof result consumed by the content Skill.
- `output.aiExecution`: Runtime-attested Luna E2E repair-loop execution, or null when disabled.
- `output.iterations`: Number of run-read-repair iterations actually performed.
- `output.trackResults`: Deterministic result for every requested implementation track.
- `output.contractFingerprint`: Fingerprint proving the test authority stayed unchanged during repair, or null when disabled.
- `output.evidenceRefs`: Exact command outputs and test evidence references.
- `output.reason`: Bounded failure, blocker, or not-needed reason, otherwise null.
