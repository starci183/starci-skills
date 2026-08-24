# Execute `test/e2e`

Execute only this operator's declared responsibility: start declared test dependencies, materialize and reset isolated data, run connected scenarios, and produce task-session E2E evidence. All intermediate data is session-only.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Analysis record:** route, facts, task ownership, and frozen refs; never chain-of-thought.
**Action:** run `validate-input.mjs` and freeze all refs and profiles.
**Session write:** `payload.session.inputRef`.
**Stop:** stop on invalid or foreign-session input.

## Step 2 — Resolve projected authority

**Read:** `payload.provided.testPlanRef`, `changeSetRef`, `seedEvidenceRef`, then `fe.e2e-testing` only.
**Context:** the approved test plan is the projection of journey and business-state authority for this step; `payload.loads.business` is `null`. Do not reload business, journey, state-modeling, or product-seeding records.
**Analysis record:** exact revisions, scenario IDs, required observables, seed identity, and the E2E rule IDs actually applied.
**Action:** verify every projected authority revision is fresh and mutually consistent without copying its body into downstream context.
**Session write:** `scratchPrefix/constraints`.
**Stop:** stop on a missing scenario, stale change/seed/test-plan revision, rejected authority, or mismatched project identity.

## Step 3 — Validate boundary and cache candidate

**Read:** source/command/resource headers plus `payload.loads.cache.fingerprintRef` and `candidateReceiptRef`.
**Context:** hashes, argv, cwd, allowed environment names, service/seed/reset IDs, and receipt lineage only; no file bodies, scan, or discovery.
**Analysis record:** the exact fingerprint over change set, scenarios, command/config, toolchain, services, seed snapshot, environment, reset contract, and knowledge generation.
**Action:** verify the boundary and candidate deterministically. Reuse only when the test plan explicitly permits it and an independently validated pass receipt has the identical full fingerprint, immutable service/data revisions, complete reset evidence, and valid retention. Never reuse a failure, blocker, partial key, or mutable-environment result.
**Session write:** `scratchPrefix/preflight`.
**Stop:** stop on drift, traversal, undeclared scope, raw secret, or unavailable resource.

## Step 4 — Load only on cache miss

**Read:** `fe.e2e-testing` and only hash-pinned targets required by the selected scenarios.
**Context:** each worker receives only one disjoint preflight target and the matching rule IDs.
**Analysis record:** value-safe observations and evidence refs.
**Action:** resolve `payload.loads.orchestration` now; `economical` is sequential, `balanced` permits three read-only workers, and `parallel` permits five. Workers only read/analyze; the coordinator joins.
**Session write:** `scratchPrefix/workers/<worker-id>` and `scratchPrefix/join`.
**Stop:** stop on overlap, out-of-scope reads, or incomplete join.

## Step 5 — Execute and decide

**Read:** joined preflight and resolved handles.
**Context:** no new context.
**Analysis record:** results, observables, and revision metadata only.
**Action:** the coordinator alone starts declared dependencies, materializes isolated data, runs connected scenarios through public interfaces, verifies every reset, and writes task-session evidence. Workers never run scenarios or mutate test data. Select one typed decision; success requires every declared scenario to pass with complete setup, observable, persistence/API, and reset evidence. If the declared confirmation policy permits a rerun, rerun only failed scenario IDs after a verified reset with identical source, command, services, seed, and environment. Contradictory outcomes are `blocked` with an explicit flaky-scenario finding; they never become pass.
**Session write:** `scratchPrefix/execution` and `scratchPrefix/decision`.
**Stop:** stop on suppression, skip, stale revision, unsafe effect, scope expansion, failed reset, exhausted confirmation budget, or unexplained contradictory outcomes.

## Step 6 — Emit and cleanup

**Read:** decision, used revisions, receipts, mutations, evidence, findings, and session inventory.
**Context:** refs only; do not copy loaded values, logs, screenshots, prompts, or observations.
**Analysis record:** schema, route, facts, and retention consistency.
**Action:** build output, align `payload.state.emits`, run `validate-output.mjs`, and register all scratch refs.
**Session write:** `payload.session.outputRef` and cleanup registration.
**Stop:** never emit invalid output; purge input, output, loads, observations, receipts, evidence, and scratch at every parent-skill terminal.
