# `fe/feedback-request` input

The input is a closed, ephemeral object owned by the current task session. The operator persists only one approved request under `.claude/requests`; every input, loaded binding, draft, observation and receipt is purged at the parent skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| root state | Skill state machine | Bind one feedback-aware skill invocation to `fe.feedback.request / ready`. |
| `payload.provided` | Previous state | Supply the feedback reference, structured per-session feedback-record reference, originating skill, project and intended upgrade owners. |
| `payload.loads` | Runtime resolver | Load only the pinned request-lifecycle rule, feedback evidence and exact request target. |
| `payload.session` | Session runtime | Name task-local input, output and scratch slots with terminal cleanup. |

The structured feedback record must contain non-empty `accepts` and `rejects` arrays, an evidence fingerprint, originating skill and proof status. Raw transcripts and expiring task-session URIs never enter the durable request.

`exactTargets` accepts one repository-relative `.claude/requests/<stable-id>.request.json` path only. Owners are closed to `starci-runtime`, `grammar`, and `local-only`; recording a request does not authorize upgrading any owner.
