# `deployment/artifact-build` input

This operator builds immutable release artifacts from pinned source revisions. Its input is an ephemeral task-session object. The runtime never persists the envelope, loaded source, command captures, worker observations, or receipts, and purges them at every parent-skill terminal.

## JSON architecture

| Section | Authored by | Purpose |
| --- | --- | --- |
| Root route fields | Skill state machine | Bind the accepted `deployment.artifact.build / ready` transition. |
| `payload.provided` | Previous state | Supply immutable execution-plan, source-revision, and artifact-build references. |
| `payload.loads` | Runtime resolver | Declare exact artifacts, deployment law, source files, commands, and orchestration loaded after validation. |
| `payload.session` | Session runtime | Name ephemeral input, output, and scratch slots. |

## Provided by the previous state

- `executionPlanRef`: the accepted session plan containing build commands and artifact identities.
- `sourceRevisionRefs`: session refs for the exact source revisions approved by the plan.
- `artifactBuildRefs`: session refs for artifact definitions, output names, and expected media types.

The operator cannot replace, broaden, or infer substitutes for these refs.

## Loaded by the runtime

- `artifacts`: resolve only the provided refs into task-session memory.
- `knowledge`: retrieve only `deployment.lifecycle` from one pinned Qdrant generation.
- `source`: open only hash-pinned target files needed by the build; broad repository context and indexed source summaries are forbidden.
- `commands`: bind declared build commands and one exact checkout; stdout, stderr, exit status, and diagnostics remain session-only.
- `orchestration`: resolve execution strategy independently from provider/model selection.

Validate the complete envelope before loading source or running a command. Acceptance requires every build command, source revision, output identity, and artifact digest to match the execution plan.
