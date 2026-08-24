# Execute `platform/mcp-publish`

This operator reconciles only the declared MCP and Qdrant runtime services, then proves authenticated, read-only search through each declared public HTTPS partition. Every input, load, observation, receipt, and output remains in the task session until the parent skill reaches a terminal state.

## Step 1 — Validate and freeze the publication request

**Read:** the complete input envelope only.
**Context:** none before validation succeeds.
**Session write:** freeze the validated envelope at `payload.session.inputRef`.
**Stop:** run `validate-input.mjs` and stop on an undeclared route, a missing `platform-source-index-ready` fact, an unbound provided ref, a foreign-session ref, or an invalid orchestration profile.
**Orchestration:** the coordinator performs validation; workers receive no input before the envelope is frozen.

## Step 2 — Resolve exact authority and artifacts

**Read:** `payload.provided`, `payload.loads.artifacts`, and `payload.loads.knowledge`.
**Context:** resolve exactly `mcpConfigReceiptRef`, `sourceIndexReceiptRef`, non-null `tunnelReceiptRef` when the config requires it, and `approvalRef`; retrieve only the pinned `platform.mcp-publication` Qdrant record.
**Session write:** record binding identities, revisions, and applied rule IDs under `payload.session.scratchPrefix/bindings`.
**Stop:** stop on a missing, stale, duplicate, mismatched, undeclared, or plan-hash-mismatched approval binding; also stop if tunnel presence does not match the frozen MCP config. Never copy loaded values into the analysis record.
**Orchestration:** balanced and parallel modes may verify disjoint artifact revisions read-only; the coordinator joins the results.

## Step 3 — Preflight exact source, commands, and external handles

**Read:** `payload.loads.source.targetFiles`, `payload.loads.commands.commandRefs`, and `payload.loads.external`.
**Context:** open only hash-pinned target files, declared command envelopes, declared MCP/Qdrant/public-HTTPS resources, and opaque credential handles. Repository-wide context and raw credential values are forbidden.
**Session write:** write value-safe preflight observations to `payload.session.scratchPrefix/preflight`.
**Stop:** stop on path traversal, source hash drift, an undeclared command or resource, missing credential custody, writable MCP capability, or scope wider than the declared partitions.
**Orchestration:** workers may inspect disjoint files or endpoints read-only. They never run commands, start services, use credentials, or mutate state.

## Step 4 — Reconcile the declared runtime

**Read:** the joined preflight record and exact command, resource, and credential-handle bindings.
**Context:** no new file, command, endpoint, collection, route, or credential may be discovered or loaded.
**Session write:** store command receipts and before/after revisions under `payload.session.scratchPrefix/execution`.
**Stop:** stop before an effect if ownership conflicts, a revision changed, a command expands scope, or rollback cannot remain inside the declared runtime boundary.
**Orchestration:** the coordinator alone starts or reconciles MCP/Qdrant services and records mutations. Workers cannot mutate source, filesystem, provider, runtime, data, or records.

## Step 5 — Prove routed read-only publication

**Read:** execution receipts and the declared public HTTPS partition probes.
**Context:** use only declared authenticated probes; do not enumerate adjacent routes, collections, projects, or zone resources.
**Session write:** write transport, authentication, partition-isolation, search-result, and read-only evidence under `payload.session.scratchPrefix/evidence`.
**Stop:** choose `blocked` if any declared partition is unreachable, crosses a role boundary, permits mutation, lacks fresh evidence, or differs from the frozen revisions. Choose `proved` only when every declared proof passes.
**Orchestration:** workers may run disjoint read-only probes; the coordinator validates the complete join and selects the decision.

## Step 6 — Emit and register terminal cleanup

**Read:** the decision, receipt, mutation revisions, context lineage, evidence refs, findings, and complete scratch inventory.
**Context:** emit references and revisions only, never loaded content, secrets, logs, prompts, or reasoning transcripts.
**Session write:** write the candidate output to `payload.session.outputRef` and register every intermediate in `payload.cleanup.scratchRefs`.
**Stop:** align the root route, `payload.state.emits`, and manifest facts; run `validate-output.mjs`; never emit an invalid or partially joined output.
**Orchestration:** the coordinator emits the output. The parent skill purges input, output, loads, observations, receipts, evidence, and scratch at every terminal state.
