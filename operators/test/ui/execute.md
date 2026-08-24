# Execute `test/ui`

Execute only this operator's declared responsibility: control the running app in a real browser, authenticate with an approved test account, and produce sanitized task-session UI evidence. All intermediate data is session-only.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Analysis record:** route, facts, task ownership, and frozen refs; never chain-of-thought.
**Action:** run `validate-input.mjs` and freeze all refs and profiles.
**Session write:** `payload.session.inputRef`.
**Stop:** stop on invalid or foreign-session input.

## Step 2 — Resolve projected authority

**Read:** `payload.provided.testPlanRef`, `changeSetRef`, `seedEvidenceRef`, then `fe.ui-testing` only.
**Context:** the approved test plan is the projection of journey, layout, responsive, and business-state authority for this step; `payload.loads.business` is `null`. Do not reload those upstream knowledge records.
**Analysis record:** exact revisions, scenario/page/state/viewport IDs, required observables, seed identity, and the UI rule IDs actually applied.
**Action:** verify every projected authority revision is fresh and mutually consistent without copying its body into downstream context.
**Session write:** `scratchPrefix/constraints`.
**Stop:** stop on partial journey coverage, a stale change/seed/test-plan revision, rejected authority, or mismatched project identity.

## Step 3 — Validate boundary and cache candidate

**Read:** source/command/resource headers plus `payload.loads.cache.fingerprintRef` and `candidateReceiptRef`.
**Context:** hashes, argv, cwd, browser/viewport/account/seed/app IDs, sanitization policy, and receipt lineage only; no file bodies, scan, or discovery.
**Analysis record:** the exact fingerprint over change set, scenarios, command/config, browser build, viewports, app/environment revision, account class, seed snapshot, and knowledge generation.
**Action:** verify the boundary and candidate deterministically. UI proof is non-cacheable by default. Reuse only when the approved test plan explicitly permits it and an independently validated pass receipt matches the full fingerprint, freshness TTL, immutable environment/data revisions, complete journey evidence, and sanitization policy. Never reuse a failure, blocker, partial key, or mutable-environment result.
**Session write:** `scratchPrefix/preflight`.
**Stop:** stop on drift, traversal, undeclared scope, raw secret, or unavailable resource.

## Step 4 — Load only on cache miss

**Read:** `fe.ui-testing` and only hash-pinned targets required by the selected scenarios.
**Context:** each worker receives only one disjoint preflight target and the matching rule IDs.
**Analysis record:** value-safe observations and evidence refs.
**Action:** economical is sequential; balanced permits three read-only workers; parallel permits five. Workers only read/analyze; the coordinator joins.
**Session write:** `scratchPrefix/workers/<worker-id>` and `scratchPrefix/join`.
**Stop:** stop on overlap, out-of-scope reads, or incomplete join.

## Step 5 — Execute and decide

**Read:** joined preflight and resolved handles.
**Context:** no new context.
**Analysis record:** results, observables, and revision metadata only.
**Action:** the coordinator alone controls the browser, authenticates through the ordinary user path, performs every declared journey at wide, intermediate, and compact viewports, and writes sanitized task-session screenshots, traces, and accessibility evidence. Workers never control the browser or account. Select one typed decision; success requires complete journey, interaction, responsive, visual, trace, console/network, and accessibility proof. If the declared confirmation policy permits a rerun, repeat only the failed scenario from a verified public entry state with identical source, browser, viewport, account class, seed, and environment. Contradictory outcomes are `blocked` with an explicit flaky-browser finding; they never become pass.
**Session write:** `scratchPrefix/execution` and `scratchPrefix/decision`.
**Stop:** stop on suppression, skip, stale revision, unsafe effect, scope expansion, failed reset, exhausted confirmation budget, or unexplained contradictory outcomes.

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
| `@fe-ui-testing` | `fe.ui-testing` | qdrant | retrieve only the pinned browser-proof law |
| `@test-cache` | `payload.loads.cache` | session | validate one exact receipt candidate before Qdrant or source loads |
| `@target-files` | `payload.loads.source.targetFiles` | exact-source | open only hash-pinned test and implementation files |
| `@browser-commands` | `payload.loads.commands` | exact-command | execute only declared application and browser commands |
| `@browser-resources` | `payload.loads.external` | exact-external | bind only the declared app, account, and opaque credential handles |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select bounded read-only preflight before coordinator browser control |
