# Execute `quality/workflow-diagnose`

This operator diagnoses one workflow invocation without changing it. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Validate the trace deterministically

**Read:** only the three declared artifacts and their revision/lineage headers.
**Context:** route events, state transitions, command exit metadata, environment identity, and evidence refs. Do not retrieve knowledge yet.
**Analysis:** verify one invocation identity, monotonically ordered events, declared transitions, complete join points, exact environment revision, and evidence hashes.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when evidence is stale, ambiguous, incomplete, or belongs to another revision.

## Step 3 — Explain the first proven divergence

**Read:** validated bindings, and accepted machine facts.
**Context:** retrieve `quality.readiness-repair` only when the validated trace contains a divergence that needs quality classification. Load no source, indexed source summary, business body, unrelated run, or full log.
**Decision criteria:** the trace explains state, route, environment, and failure evidence without mutating the observed workflow.
**Analysis:** compare expected and observed state at each declared edge, stop at the earliest evidenced divergence, distinguish upstream cause from downstream symptom, and attach confidence plus competing-evidence refs. Record conclusions only; never invent missing events or record chain-of-thought.
**Session write:** candidate `diagnosisReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit `inconclusive` when the trace is stale, incomplete, or contradictory; emit `external-blocker` when a declared dependency prevents a verdict. Never fabricate `diagnosed`.

## Step 4 — Emit and register cleanup

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
| `@knowledge-1` | `quality.readiness-repair` | qdrant | retrieve only after a proven divergence needs classification |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
