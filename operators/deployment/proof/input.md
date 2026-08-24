# `deployment/proof` input

This closed JSON object is ephemeral task-session state. It is never persisted to source, worktrees, Qdrant, logs, or a run directory and is purged on every parent-skill terminal state.

## JSON architecture

| Section | Owner | Meaning |
| --- | --- | --- |
| Root envelope | Skill machine | Accepted stage, status, and facts. |
| `payload.provided` | Previous state | Immutable `previousStateRef`, `deploymentIntentRef`, `executionPlanRef`, and nullable `approvalRef`. |
| `payload.loads` | Runtime resolver | Exact deployment law, files, commands, resources, credentials, and orchestration to load. |
| `payload.session` | Session runtime | Ephemeral input, output, scratch, and cleanup lifetime. |

## Runtime loads

- `business`: must be `null`; the deployment intent is already pinned by the previous state.
- `knowledge`: retrieve only `deployment.lifecycle` from its pinned generation and content hash.
- `source`: open only declared hash-pinned manifest, plan, config, migration, or proof files; broad repository preloading is forbidden.
- `commands`: resolve only declared argv, working directory, and allowed environment names.
- `external`: resolve only declared provider/runtime/data resources and opaque credential handles.
- `orchestration`: resolve one mode and provider profile.

Validate before loading. Loaded values remain below `payload.session.scratchPrefix` and are never copied into output.
