# `fe/request-review` output

Return `approved`, `rejected`, or `blocked`. A completed review describes exactly one idempotent request upsert and never copies the request body or raw approval message into output.

Approval authorizes only the later owner-specific resolution skill. It does not itself mutate `.claude`, Grammar, or product source. Rejection preserves the request and its feedback-session ledger with a durable rationale.

## JSON architecture

| Section | Purpose |
| --- | --- |
| root state | Emit the declared complete or blocked route. |
| `payload.state` | Bind decision, code, retryability and fact delta. |
| `payload.produced` | Describe the single request-ledger upsert for a completed review. |
| `payload.context` | List only references and revisions actually used. |
| `payload.cleanup` | Purge all task-session intermediates at `skill-terminal`. |
