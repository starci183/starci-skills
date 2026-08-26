# `workspace/workflow-handoff` output

Return one published, resumed or blocked result. The output exposes only the immutable checkpoint tag, exact pushed-head receipts, the validated next capability/stage and bounded evidence.

The Git tag message is the portable continuation manifest. It contains schema version, mission id, Source identity, exact repository origins/branches/heads, next capability/stage and durable artifact refs. It never contains source bodies, prompts, reasoning, generated context, credentials, absolute paths or task-session refs.

## JSON architecture

| Section | Ownership |
| --- | --- |
| `payload.state` | Stable operator code, status and emitted transition. |
| `payload.produced` | Checkpoint tag, exact Git-head receipts and validated continuation target. |
| `payload.context` | Exact session and Git refs used for the decision. |
| `payload.cleanup` | Task scratch purged at `skill-terminal`. |

`payload.state` binds the decision to the operator code and emitted stage. `payload.cleanup` lists task-owned scratch refs and purges them at `skill-terminal`; only the approved Git commits, branches and annotated checkpoint tag survive.
