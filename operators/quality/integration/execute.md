# Execute `quality/integration`

This operator runs the declared integration gate. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Resolve headers and exact cache candidate

**Read:** artifact revision headers, execution identity, `payload.loads.cache.fingerprintRef`, and optional `candidateReceiptRef`.
**Context:** refs, hashes, command/config/toolchain/environment revisions, and receipt lineage only. Do not retrieve Qdrant knowledge or repository source.
**Analysis:** deterministically validate ownership and freshness, recompute the full fingerprint, and accept only an independently validated pass receipt with identical fingerprint, gate version, evidence hash, and retention. Failure/blocker receipts, partial keys, and unverifiable lineage are cache misses.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when authority is stale, ambiguous, incomplete, or belongs to another revision. A trusted cache hit skips command execution and proceeds to emission without model reasoning.

## Step 3 — Run the exact quality command

**Read:** `payload.loads.execution` and the minimum validated refs required by that command.
**Context:** execute the pinned command in the exact checkout on a cache miss. Do not retrieve knowledge or preload repository source into model context.
**Action:** run once under the declared environment and capture exit code, structured diagnostics, and evidence hashes.
**Session write:** `scratchPrefix/command-capture`; never write ignored gate evidence to disk.
**Orchestration:** command execution has one coordinator owner. Independent post-run diagnostic classification may fan out read-only; the coordinator joins results deterministically.
**Stop:** classify timeout, unavailable dependency, or environment failure as the declared external/blocking decision.

## Step 4 — Evaluate the result

**Read:** validated bindings, command capture, and accepted machine facts.
**Context:** a deterministic green result needs no additional context. Only for a non-green or structurally ambiguous capture, retrieve `quality.source-gates` from the pinned generation; load no source or business feature.
**Decision criteria:** the pinned command verifies declared service boundaries without undeclared dependencies.
**Analysis:** classify integration failures by ownership. A bounded confirmation rerun may target only failed scenarios after a verified reset under an identical fingerprint. Contradictory outcomes emit `external-blocker` with an explicit flaky-scenario finding; a rerun never converts an unexplained failure into pass. Record applied criteria, structured diagnostics, and conclusions only; never record chain-of-thought.
**Session write:** candidate `integrationReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit only one declared decision; stop on failed reset, exhausted confirmation budget, inconsistent outcomes, or repair-boundary widening.

## Step 5 — Emit and register cleanup

**Read:** candidate, decision evidence, lineage.
**Context:** return refs and revisions only, not loaded content, full command logs, prompts, or observations.
**Action:** construct `output.schema.json`; align decision, state, root route, and emitted facts; run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list all scratch refs in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediate session objects at the parent terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session | resolve only previous-state refs |
| `@knowledge-1` | `quality.source-gates` | qdrant | retrieve only after a non-green or ambiguous command result |
| `@exact-cache` | `payload.loads.cache` | session | validate one exact pass-receipt candidate before any Qdrant retrieval or command |
| `@exact-command` | `payload.loads.execution` | command | run one pinned command and retain capture in session |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
