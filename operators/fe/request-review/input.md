# `fe/request-review` input

Review exactly one durable frontend feedback request. The input is closed and task-session owned; only the request's `status` and `review` fields may survive.

The reviewer supplies an explicit `approved` or `rejected` decision plus `normal` or `urgent` priority. `urgent` changes queue order only; it never relaxes evidence, ownership, or mutation boundaries. The exact target must remain `.claude/requests/<stable-id>.request.json`, and approved owners must be a subset of the request's declared owners.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| root state | Skill state machine | Bind the invocation to `fe.request.review / ready`. |
| `payload.provided` | Previous state and explicit reviewer | Supply request and review-evidence refs, project, decision, priority and bounded owners. |
| `payload.loads` | Runtime resolver | Load only the pinned request-lifecycle rule, exact request revision, review evidence and one exact target. |
| `payload.session` | Session runtime | Name task-local input, output and scratch slots with terminal cleanup. |

Every `payload.provided` and `payload.loads.upstream` reference must belong to the same task. A completed review never carries raw feedback or approval prose in its output.
