# Execute `test/unit`

Execute only this operator's declared responsibility: run manifest-owned focused unit commands and produce task-session unit evidence. All intermediate data is session-only.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Analysis record:** route, facts, task ownership, and frozen refs; never chain-of-thought.
**Action:** run `validate-input.mjs` and freeze all refs and profiles.
**Session write:** `payload.session.inputRef`.
**Stop:** stop on invalid or foreign-session input.

## Step 2 — Resolve authority headers

**Read:** `payload.provided` refs and their revision headers only.
**Context:** `payload.loads.business` is `null`; do not retrieve testing knowledge or source yet.
**Analysis record:** test-plan, change-set, seed, command, toolchain, and environment revisions.
**Action:** validate projected authority and normalize exact test IDs without copying artifact bodies.
**Session write:** `scratchPrefix/constraints`.
**Stop:** stop on missing, stale, rejected, or mismatched authority.

## Step 3 — Validate boundary and cache candidate

**Read:** command/resource headers plus `payload.loads.cache.fingerprintRef` and `candidateReceiptRef`.
**Context:** hashes, argv, cwd, allowed environment names, resource IDs, and receipt lineage only; no file contents, Qdrant record, scan, or discovery.
**Analysis record:** the exact fingerprint over change set, selected test IDs, command/config, toolchain, environment, seed, and knowledge generation.
**Action:** verify the boundary and candidate receipt deterministically. Reuse only an independently validated pass receipt whose full fingerprint and evidence hash match. Treat a miss, failure receipt, blocker receipt, partial key, or unverifiable lineage as non-reusable.
**Session write:** `scratchPrefix/preflight`.
**Stop:** stop on drift, traversal, undeclared scope, raw secret, or unavailable resource.

## Step 4 — Load only on cache miss

**Read:** `fe.unit-testing` and only hash-pinned target files needed to prepare or classify this run.
**Context:** each read-only worker receives one disjoint target plus the minimum matching rule IDs; source files irrelevant to the selected test IDs remain unopened.
**Analysis record:** value-safe observations and evidence refs.
**Action:** economical is sequential; balanced permits three read-only workers; parallel permits five. The coordinator validates and joins; workers never execute tests or write.
**Session write:** `scratchPrefix/workers/<worker-id>` and `scratchPrefix/join`.
**Stop:** stop on overlap, out-of-scope reads, or incomplete join.

## Step 5 — Execute and decide

**Read:** joined preflight and resolved handles.
**Context:** no new context.
**Analysis record:** results, observables, and revision metadata only.
**Action:** the coordinator alone runs the focused unit commands and writes task-session evidence. Workers never run tests or write. Select one typed decision; success requires at least one selected and passed target test, zero failed tests, zero skipped target tests, and declared changed-owner coverage. If the declared confirmation policy permits a rerun, rerun only the failed test IDs with identical source, command, toolchain, seed, and environment. Contradictory outcomes are `blocked` with an explicit flaky-test finding; they never become pass.
**Session write:** `scratchPrefix/execution` and `scratchPrefix/decision`.
**Stop:** stop on suppression, skip, stale revision, unsafe effect, scope expansion, exhausted confirmation budget, or unexplained contradictory outcomes.

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
| `@test-cache` | `payload.loads.cache` | session | validate one exact receipt candidate before knowledge or source loads |
| `@target-files` | `payload.loads.source.targetFiles` | exact-source | open only hash-pinned files needed after a cache miss |
| `@test-commands` | `payload.loads.commands` | exact-command | execute only the declared unit-test commands |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select bounded read-only preflight before coordinator execution |
