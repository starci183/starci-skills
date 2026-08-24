# Execute `test/unit`

Execute only this operator's declared responsibility: run manifest-owned focused unit commands and produce task-session unit evidence. All intermediate data is session-only.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Analysis record:** route, facts, task ownership, and frozen refs; never chain-of-thought.
**Action:** run `validate-input.mjs` and freeze all refs and profiles.
**Session write:** `payload.session.inputRef`.
**Stop:** stop on invalid or foreign-session input.

## Step 2 — Resolve authority

**Read:** `payload.provided`, business, and knowledge loads.
**Context:** exact pinned bindings only; business, when required, comes only from `.worktrees/business/...`.
**Analysis record:** revision matches and rule IDs.
**Action:** normalize constraints without copying loaded content.
**Session write:** `scratchPrefix/constraints`.
**Stop:** stop on missing, stale, rejected, or mismatched authority.

## Step 3 — Resolve boundary

**Read:** source, command, and external loads.
**Context:** exact files, declared commands/resources, and opaque handles only; no scan or discovery.
**Analysis record:** hashes, argv, cwd, allowed environment names, and resource IDs.
**Action:** verify without executing.
**Session write:** `scratchPrefix/preflight`.
**Stop:** stop on drift, traversal, undeclared scope, raw secret, or unavailable resource.

## Step 4 — Orchestrate analysis

**Read:** disjoint preflight assignments.
**Context:** each worker receives only its assigned target and minimum rules.
**Analysis record:** value-safe observations and evidence refs.
**Action:** economical is sequential; balanced permits three read-only workers; parallel permits five. Workers only read/analyze; the coordinator joins.
**Session write:** `scratchPrefix/workers/<worker-id>` and `scratchPrefix/join`.
**Stop:** stop on overlap, out-of-scope reads, or incomplete join.

## Step 5 — Execute and decide

**Read:** joined preflight and resolved handles.
**Context:** no new context.
**Analysis record:** results, observables, and revision metadata only.
**Action:** the coordinator alone runs the focused unit commands and writes task-session evidence. Workers never run tests or write. Select one typed decision; success requires at least one selected and passed target test, zero failed tests, zero skipped target tests, and declared changed-owner coverage.
**Session write:** `scratchPrefix/execution` and `scratchPrefix/decision`.
**Stop:** stop on suppression, skip, stale revision, unsafe effect, or scope expansion.

## Step 6 — Emit and cleanup

**Read:** decision, used revisions, receipts, mutations, evidence, findings, and session inventory.
**Context:** refs only; do not copy loaded values, logs, screenshots, prompts, or observations.
**Analysis record:** schema, route, facts, and retention consistency.
**Action:** build output, align `payload.state.emits`, run `validate-output.mjs`, and register all scratch refs.
**Session write:** `payload.session.outputRef` and cleanup registration.
**Stop:** never emit invalid output; purge input, output, loads, observations, receipts, evidence, and scratch at every parent-skill terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@fe-unit-testing` | `fe.unit-testing` | qdrant | retrieve only the pinned unit-testing law |
| `@target-files` | `payload.loads.source.targetFiles` | exact-source | open only hash-pinned test and implementation files |
| `@test-commands` | `payload.loads.commands` | exact-command | execute only the declared unit-test commands |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select bounded read-only preflight before coordinator execution |
