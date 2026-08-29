# `workspace/workflow-handoff` input

Provide exact route, approval, and checkout receipts plus one publish or resume request. Durable artifact references must be portable authority references, never `session://` values or conversational content.

## Contract fields

- `context.routeReceiptRef`: Exact routed-checkout receipt.
- `context.approvalRef`: Exact explicit-authorization receipt.
- `context.touchedCheckoutRefs`: Exact mission-owned checkout receipts.
- `input.operation`: One portable checkpoint operation.
- `input.missionId`: Stable mission identity.
- `input.checkpointTag`: Exact continuation tag for resume, null for publish.
- `input.resumeCapability`: Capability that continues the mission.
- `input.resumePoint`: Portable next-work marker without conversation content.
- `input.durableArtifactRefs`: Minimal durable references; session-only references are forbidden.
