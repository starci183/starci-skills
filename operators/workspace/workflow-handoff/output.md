# `workspace/workflow-handoff` output

Return one closed checkpoint result. `published` pairs only with `published-checkpoint`, `resumed` only with `resumed-checkpoint`, and `blocked` only with `none`; the parent Skill machine owns routing.

## Contract fields

- `output.outcome`: Typed atomic result consumed by the parent Skill machine.
- `output.resultKind`: Domain result identity that agrees with outcome.
- `output.checkpointTag`: Published or adopted continuation tag.
- `output.sourcePushRefs`: Mission-owned Git heads.
- `output.resumeCapability`: Capability encoded in the checkpoint.
- `output.resumePoint`: Portable next-work marker.
- `output.receiptRef`: Ephemeral execution proof receipt.
- `output.evidenceRefs`: Exact supporting evidence.
- `output.findings`: Bounded findings.
- `output.reason`: Blocker explanation, otherwise null.
