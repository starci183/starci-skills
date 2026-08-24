# Execute `quality/typecheck`

This operator runs the type-check gate. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Resolve exact evidence and quality law

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve exact session artifacts and retrieve only `quality.source-gates` from its pinned generation.
**Analysis:** verify refs, revisions, ownership, and freshness. Record rule IDs and match/mismatch evidence only.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when evidence is stale, ambiguous, incomplete, or belongs to another revision.

## Step 3 — Run the exact quality command

**Read:** `payload.loads.execution` and the minimum validated refs required by that command.
**Context:** execute the pinned command in the exact checkout. Do not preload repository source into model context.
**Action:** run once under the declared environment and capture exit code, structured diagnostics, and evidence hashes.
**Session write:** `scratchPrefix/command-capture`; never write ignored gate evidence to disk.
**Orchestration:** command execution has one coordinator owner. Independent post-run diagnostic classification may fan out read-only; the coordinator joins results deterministically.
**Stop:** classify timeout, unavailable dependency, or environment failure as the declared external/blocking decision.

## Step 4 — Evaluate the result

**Read:** validated bindings, command capture, and accepted machine facts.
**Context:** load no undeclared knowledge, source, or business feature.
**Decision criteria:** the pinned compiler reports no type failure for the approved source revision.
**Analysis:** execute the exact type-check command and retain structured diagnostics. Record applied criteria, structured diagnostics, and conclusions only; never record chain-of-thought.
**Session write:** candidate `typecheckReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit only one declared decision and never widen a repair boundary.

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
| `@knowledge-1` | `quality.source-gates` | qdrant | retrieve only this quality law |
| `@exact-command` | `payload.loads.execution` | command | run one pinned command and retain capture in session |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
