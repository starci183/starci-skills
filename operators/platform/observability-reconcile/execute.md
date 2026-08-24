# Execute `platform/observability-reconcile`

This operator reconciles only the declared cAdvisor, Prometheus, Grafana, and remote-write boundary. Inputs, loads, observations, receipts, evidence, and output are task-session objects purged at every parent-skill terminal.

## Step 1 — Validate and freeze

**Read:** the complete input envelope only.
**Context:** none before validation.
**Session write:** freeze the accepted envelope at `payload.session.inputRef`.
**Stop:** run `validate-input.mjs`; stop on route, binding, session-ownership, path, or orchestration failure.
**Orchestration:** the coordinator validates; workers receive nothing until validation passes.

## Step 2 — Resolve authority and provided artifacts

**Read:** `payload.provided`, `payload.loads.artifacts`, and `payload.loads.knowledge`.
**Context:** resolve exactly `stackRef`, `metricsDestinationRef`, `credentialReceiptRef`, and `approvalRef`; retrieve only the pinned `platform.observability` record.
**Session write:** write identities, revisions, and applied rule IDs to `payload.session.scratchPrefix/bindings`.
**Stop:** stop on missing, stale, duplicate, mismatched, undeclared, or plan-hash-mismatched approval bindings; never copy loaded values into observations.
**Orchestration:** workers may verify disjoint revisions read-only; the coordinator joins them.

## Step 3 — Preflight exact files, commands, and external state

**Read:** `payload.loads.source.targetFiles`, `payload.loads.commands.commandRefs`, and `payload.loads.external`.
**Context:** open only hash-pinned configuration files, declared command envelopes, declared observability resources, and opaque credential handles. Broad repository context and raw secrets are forbidden.
**Session write:** write hashes, declared targets, resource revisions, and value-safe observations to `payload.session.scratchPrefix/preflight`.
**Stop:** stop on source drift, traversal, target expansion, credential exposure, undeclared remote-write destination, or conflicting ownership.
**Orchestration:** workers may inspect disjoint files and health resources read-only; they cannot run commands, use credentials, or mutate state.

## Step 4 — Reconcile the observability boundary

**Read:** the complete joined preflight and exact command/resource handles.
**Context:** no new file, service, target, dashboard, destination, or credential may be discovered.
**Session write:** record command receipts and before/after revisions under `payload.session.scratchPrefix/execution`.
**Stop:** stop before an unsafe or stale effect, and stop if rollback would cross the declared stack or destination.
**Orchestration:** the coordinator alone applies configuration and records filesystem, runtime, provider, or record mutations.

## Step 5 — Prove health and decide

**Read:** execution receipts and only the declared scrape, dashboard, and remote-write probes.
**Context:** no adjacent service or provider enumeration.
**Session write:** write bounded target health, credential protection, and remote-write evidence to `payload.session.scratchPrefix/evidence`.
**Stop:** choose `blocked` on missing/stale proof, target leakage, unhealthy required service, or failed remote write. Choose `proved` only when every declared check passes.
**Orchestration:** workers may perform disjoint read-only probes; the coordinator validates the join and owns the decision.

## Step 6 — Emit and register cleanup

**Read:** decision, receipt, mutation revisions, used-context lineage, evidence refs, findings, and scratch inventory.
**Context:** emit refs and revisions only; never emit loaded values, secrets, logs, prompts, or reasoning.
**Session write:** write to `payload.session.outputRef` and list every intermediate in `payload.cleanup.scratchRefs`.
**Stop:** align root route, state, and manifest facts; run `validate-output.mjs`; never emit invalid output.
**Orchestration:** the coordinator emits; the parent skill purges all session objects at every terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session-exact | bind the three provided receipts exactly |
| `@platform-operations` | `platform.observability` | qdrant | retrieve the only knowledge authority |
| `@exact-source` | `payload.loads.source.targetFiles` | exact-source | inspect only hash-pinned observability configuration |
| `@declared-commands` | `payload.loads.commands.commandRefs` | declared-only | execute only pre-authorized command envelopes |
| `@external-bindings` | `payload.loads.external` | external-exact | bind exact stack, destination, probe, and credential resources |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select topology independently of provider mapping |
