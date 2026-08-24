# Execute `platform/mcp-config`

Compile one approved MCP topology into one generated execution configuration. All input, output, context, observations, and receipts are task-session-only.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@platform-operations` | `platform.mcp-publication` | qdrant | retrieve only the platform execution law required by this operator |
| `@platform-plan` | `payload.provided.platformPlanRef` | session | bind the exact approved MCP topology and proof requirements |
| `@config-target` | `payload.provided.configTargetRef` | session | bind the only writable generated-config target and baseline |
| `@target-files` | `payload.loads.source.targetFiles` | exact-source | open only declared plan, manifest, template, and config files |
| `@validation-commands` | `payload.loads.commands.commandRefs` | exact-command | run only declared config validation commands |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | choose sequential or read-only fan-out preflight |

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Analysis record:** accepted route, required facts, task ownership, and frozen refs; never chain-of-thought.
**Action:** run `validate-input.mjs` and freeze the plan, target, approval, hashes, commands, and orchestration profile.
**Session write:** validated input at `payload.session.inputRef`.
**Durable write:** none.
**Stop:** stop on invalid schema, foreign session refs, or missing approval ownership.

## Step 2 — Resolve exact platform law

**Read:** `payload.provided` and `payload.loads.knowledge`; confirm `payload.loads.business` is null.
**Context:** retrieve only `platform.mcp-publication` at the declared generation and content hash. Do not infer platform configuration from product source.
**Analysis record:** revision match and applicable MCP configuration rule identifiers only.
**Action:** normalize the approved services, routes, partitions, ports, volumes, exclusions, and proof criteria.
**Session write:** constraints below `payload.session.scratchPrefix/constraints`.
**Durable write:** none.
**Stop:** stop on missing, stale, rejected, or mismatched plan, approval, or knowledge.

## Step 3 — Resolve exact files and commands

**Read:** `payload.loads.source`, `payload.loads.commands`, and `payload.loads.external`.
**Context:** exact hash-pinned plan, manifest, template, and generated-config target files plus declared validation commands. No repository scan, command discovery, external service, or credential load.
**Analysis record:** target hashes, argv, working directory, allowed environment names, and target access mode.
**Action:** verify all paths are relative, all baselines match, the config target is the only writable file, and commands are validation-only.
**Session write:** preflight below `payload.session.scratchPrefix/preflight`.
**Durable write:** none.
**Stop:** stop on hash drift, traversal, undeclared target, unexpected external resource, raw secret, or unsafe command.

## Step 4 — Orchestrate read-only preflight

**Read:** normalized constraints and disjoint service, route, and partition assignments.
**Context:** each worker receives only its assigned plan subset and minimum platform rule identifiers.
**Analysis record:** value-safe completeness, collision, and ownership observations, never prompts or internal reasoning.
**Action:** `economical` is sequential; `balanced` permits up to three read-only workers; `parallel` permits up to five. Workers only read and analyze. The coordinator validates and joins every observation.
**Session write:** observations below `payload.session.scratchPrefix/workers/<worker-id>` and the join below `payload.session.scratchPrefix/join`.
**Durable write:** none.
**Stop:** stop on overlapping assignments, route/port/partition collision, out-of-scope reads, or incomplete join.

## Step 5 — Render and validate the config

**Read:** joined preflight, normalized constraints, exact templates, config baseline, and validation command refs.
**Context:** no new context may be loaded.
**Analysis record:** rendered entry identities, validation results, and before/after config hashes only.
**Action:** the coordinator renders every approved service, route, partition, port, and volume; writes only the approved config target; then runs only declared validation commands. Workers never render, run commands, or write.
**Session write:** render plan, command receipts, and mutation metadata below `payload.session.scratchPrefix/execution`.
**Durable write:** the approved ignored generated MCP execution config only.
**Stop:** stop before writing when a declaration is ambiguous; stop after a safe restore when validation fails or an undeclared entry appears.

## Step 6 — Select the typed state

**Read:** render receipt, validation receipts, before/after hashes, and declared proof criteria.
**Context:** pinned constraints and joined evidence only.
**Analysis record:** criteria-to-evidence matches and the `ready` decision.
**Action:** select `ready` only when the generated config exactly covers the approved topology, contains no credential values or undeclared entries, and all validation commands pass.
**Session write:** decision below `payload.session.scratchPrefix/decision`.
**Durable write:** none beyond the approved Step 5 config.
**Stop:** do not emit success for partial coverage, stale hashes, skipped validation, or a failed safe restore.

## Step 7 — Validate output and cleanup

**Read:** decision, context revisions, receipt refs, config mutation metadata, evidence, findings, and session inventory.
**Context:** references only; do not copy loaded files, rendered config, logs, prompts, or observations into output.
**Analysis record:** schema, route, fact, and retention consistency.
**Action:** construct `output.schema.json`, align `payload.state.emits` with the root state, run `validate-output.mjs`, and register every intermediate in `payload.cleanup.scratchRefs`.
**Session write:** output at `payload.session.outputRef` and cleanup registration inside it.
**Durable write:** none.
**Stop:** never emit invalid output; purge input, output, loads, observations, receipts, evidence, and scratch on every parent-skill terminal state.
