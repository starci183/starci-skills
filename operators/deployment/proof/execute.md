# Execute `deployment/proof`

Join exact deployment evidence into one release proof. All intermediate data and evidence are task-session-only.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Analysis record:** route, facts, task ownership, and frozen refs; never chain-of-thought.
**Action:** run `validate-input.mjs` and freeze all refs, targets, commands, resources, approval, and orchestration.
**Session write:** `payload.session.inputRef`.
**Durable write:** none.
**Stop:** stop on invalid schema, foreign session ref, or missing required approval.

## Step 2 — Resolve exact deployment law

**Read:** provided refs and knowledge; confirm business load is null.
**Context:** retrieve only `deployment.lifecycle` at the declared generation and hash.
**Analysis record:** revision matches and applicable lifecycle rule IDs only.
**Action:** normalize exact intent, actions, checkpoints, exclusions, proof, and rollback.
**Session write:** `scratchPrefix/constraints`.
**Durable write:** none.
**Stop:** stop on missing, stale, rejected, or mismatched authority.

## Step 3 — Resolve exact boundary

**Read:** source, command, and external loads.
**Context:** exact files, declared commands/resources, and opaque credential handles only; no scan, discovery, or secret-value load.
**Analysis record:** hashes, argv, cwd, environment-name allowlist, resource identity, and credential scope.
**Action:** verify all identities without executing or mutating.
**Session write:** `scratchPrefix/preflight`.
**Durable write:** none.
**Stop:** stop on drift, traversal, undeclared target, raw secret, unavailable resource, or credential overreach.

## Step 4 — Orchestrate read-only preflight

**Read:** normalized constraints and disjoint target/resource assignments.
**Context:** each worker receives only its assigned target and minimum lifecycle rules.
**Analysis record:** value-safe observations and evidence refs, never prompts or internal reasoning.
**Action:** economical is sequential; balanced permits three read-only workers; parallel permits five. Workers only read/analyze; the coordinator validates and joins.
**Session write:** `scratchPrefix/workers/<worker-id>` and `scratchPrefix/join`.
**Durable write:** none.
**Stop:** stop on overlap, out-of-scope reads, secret exposure, or incomplete join.

## Step 5 — Execute the operation

**Read:** joined preflight, exact constraints, and resolved handles.
**Context:** no new context may be loaded.
**Analysis record:** command outcomes, provider/data observations, and before/after identities only.
**Action:** Validate the pinned intent, artifact digest, migration or not-applicable receipt, domain state, rollout identity, stabilization observations, and recovery or rollback evidence when present; do not rerun deployment actions. Workers never run commands or deployments and never mutate filesystem, runtime, provider, or data state; the coordinator owns effects and joins.
**Session write:** observations and receipts below `scratchPrefix/execution`.
**Durable write:** none; this operator is read-only outside task-session state.
**Stop:** stop on suppression, stale revision, unsafe effect, scope expansion, partial mutation, or failed rollback precondition. A provider/probe transport failure emits `external-error`; it never becomes success or a fabricated product failure.

## Step 6 — Select typed state

**Read:** execution receipts and declared proof criteria.
**Context:** pinned constraints and joined evidence only.
**Analysis record:** criteria-to-evidence matches and one typed decision.
**Action:** select one manifest decision. `complete` is legal only for the originally intended release after `deployment-steady`. `rolled-back` is legal only when the declared safe release is active after `deployment-rolled-back`; it emits a distinct terminal truth and never delivery success. Both require every mandatory lifecycle invariant to have current task-session evidence for the same target, environment, and provider revisions.
**Session write:** `scratchPrefix/decision`.
**Durable write:** none beyond approved Step 5 mutations.
**Stop:** never convert missing evidence into success; use only declared routes.

## Step 7 — Validate output and cleanup

**Read:** decision, revisions, receipts, mutations, evidence, findings, and session inventory.
**Context:** refs only; do not copy loaded values, logs, prompts, provider payloads, or observations.
**Analysis record:** schema, route, fact, and retention consistency.
**Action:** build output, align `payload.state.emits`, run `validate-output.mjs`, and register all scratch refs.
**Session write:** `payload.session.outputRef` and cleanup registration.
**Durable write:** none.
**Stop:** never emit invalid output; purge all intermediates on every parent-skill terminal state.
