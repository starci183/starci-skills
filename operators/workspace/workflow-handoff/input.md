# `workspace/workflow-handoff` input

This operator transfers one active coding mission through Git without transferring conversational context. Its closed input remains task-session-only.

## JSON architecture

| Section | Ownership |
| --- | --- |
| `payload.provided` | Explicit publish/resume mode, verified route, mutation approval, mission identity, checkpoint tag or next-capability contract, and the closed checkout/artifact refs. |
| `payload.loads` | Exact session bindings for the provided refs plus one orchestration profile; no knowledge body is loaded. |
| `payload.session` | Task-owned input, output and scratch slots retained only until the parent skill terminal. |

In `publish` mode, `checkpointTag` is null and `resumeCapability` plus `resumeStage` are required. In `resume` mode, `checkpointTag` is required and the resume target is read from its signed-by-hash annotated manifest. Durable artifact refs may identify committed request, design, contract or proof artifacts; they may not be `session://` refs.
