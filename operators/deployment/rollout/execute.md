# Execute `deployment/rollout`

Roll out the approved immutable release. All intermediate data and evidence are task-session-only.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@deployment-lifecycle` | `deployment.lifecycle` | qdrant | retrieve only deployment lifecycle law |
| `@deployment-intent` | `payload.provided.deploymentIntentRef` | session | bind the pinned release and target |
| `@execution-plan` | `payload.provided.executionPlanRef` | session | bind exact actions, proof, and rollback |
| `@target-files` | `payload.loads.source.targetFiles` | exact-source | open only declared deployment files |
| `@declared-commands` | `payload.loads.commands.commandRefs` | exact-command | run only approved commands |
| `@external-resources` | `payload.loads.external` | external-exact | bind exact resources and opaque credentials |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select sequential or read-only fan-out |

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
**Action:** The coordinator verifies the published digest, domain, migration state, target baseline, strategy, health checkpoints, and rollback identity; then applies only the declared rollout actions and pauses at every checkpoint for proof. Workers never run commands or deployments and never mutate filesystem, runtime, provider, or data state; the coordinator owns effects and joins.
**Session write:** observations and receipts below `scratchPrefix/execution`.
**Durable write:** only mutations declared by the execution plan and bound by non-null approval.
**Stop:** stop on suppression, stale revision, unsafe effect, scope expansion, partial mutation, or failed rollback precondition.

## Step 6 — Select typed state

**Read:** execution receipts and declared proof criteria.
**Context:** pinned constraints and joined evidence only.
**Analysis record:** criteria-to-evidence matches and one typed decision.
**Action:** select one manifest decision. Success requires the intended immutable digest is active on every declared target and all bounded rollout checkpoints pass with rollback still reachable.
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
