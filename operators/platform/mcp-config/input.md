# `platform/mcp-config` input

The input is a closed ephemeral object owned by the current task session. It is never persisted to source, worktrees, Qdrant, logs, or a run directory and is purged on every parent-skill terminal state.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root envelope | Skill state machine | Bind the invocation to `platform.mcp.config / ready`. |
| `payload.provided` | Previous state | Supply immutable refs already approved for config generation. |
| `payload.loads` | Runtime resolver | Declare the exact platform law, config targets, commands, and orchestration profile to load. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots and their cleanup lifetime. |

## Provided by the previous state

- `previousStateRef`: accepted previous-state output.
- `platformPlanRef`: exact MCP services, routes, partitions, ports, volumes, and proof requirements.
- `configTargetRef`: approved generated-config target and baseline hash.
- `approvalRef`: approval binding the exact writable config target and plan revision.

The operator cannot replace these references, infer substitutes, or broaden their scope.

## Loaded by the runtime

- `business`: must be `null`; this technical operation does not load business authority.
- `knowledge`: retrieve only `platform.mcp-publication` from its pinned generation and content hash.
- `source`: open only declared hash-pinned platform plan, manifest, template, and config target files. Repository-wide preloading is forbidden.
- `commands`: resolve only declared validation commands with exact argv, working directory, and allowed environment names.
- `external`: must contain no external resources or credential values; config generation is local.
- `orchestration`: resolve one execution mode and provider profile.

Validate before loading. Loaded values remain below `payload.session.scratchPrefix` and are never copied into output.
