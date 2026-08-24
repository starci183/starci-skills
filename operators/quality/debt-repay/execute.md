# Execute `quality/debt-repay`

This operator repays one approved debt scope. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Resolve exact evidence and quality law

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve exact session artifacts and retrieve only `quality.readiness-repair` from its pinned generation.
**Analysis:** verify debt identity, owner approval, expiry, baseline metric, closure criterion, permitted writes, prior-iteration fingerprint, and remaining iteration budget.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** block on stale/expired approval, ambiguous owner, foreign revision, repeated iteration fingerprint, or exhausted budget before reading source.

## Step 3 — Inspect the exact repair targets

**Read:** only `payload.loads.source.targetFiles`.
**Context:** broad scans, undeclared paths, and indexed source summaries are forbidden.
**Analysis:** verify each before hash, allowed repair, owner, and debt/finding relevance.
**Session write:** `scratchPrefix/source-checks/<worker-id>`.
**Orchestration:** read-only workers may inspect disjoint files; the coordinator validates and joins all observations. Workers never write source.
**Stop:** emit boundary drift or blocked before mutation when a hash, owner, or target is invalid.

## Step 4 — Evaluate the result

**Read:** validated bindings, joined source checks, and accepted machine facts.
**Context:** load no undeclared knowledge, source, or business feature.
**Decision criteria:** each mutation is inside the debt scope and measured exit criteria prove closure or progress.
**Analysis:** compile one bounded patch plan and predict its measured effect; do not mutate in this step. `progress` is legal only when the post-write metric will be strictly better or the declared remainder strictly smaller. Record conclusions only; never record chain-of-thought.
**Session write:** candidate `debtReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit only one declared decision and never widen a repair boundary.

## Step 5 — Apply the approved repair

**Read:** exact targets, validated candidate, and approved mutation scope.
**Context:** coordinator only. Workers do not write source or durable authority.
**Action:** recheck before hashes, mutate only declared exact files and permitted responsibilities, measure the declared criterion, and update only the durable debt record. If the metric is unchanged, restore only this operator's own exact before-images after verifying no concurrent drift, emit blocked, and do not loop as progress. Never revert unrelated user work.
**Durable write:** approved product-source files and the declared durable debt record only.
**Session write:** before/after hashes at `scratchPrefix/mutations`.
**Stop:** emit boundary drift or blocked if correct repair needs another file, responsibility, or authority.

## Step 6 — Emit and register cleanup

**Read:** candidate, decision evidence, lineage, and mutation hashes.
**Context:** return refs and revisions only, not loaded content, full command logs, prompts, or observations.
**Action:** construct `output.schema.json`; align decision, state, root route, and emitted facts; run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list all scratch refs in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediate session objects at the parent terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session | resolve only previous-state refs |
| `@knowledge-1` | `quality.readiness-repair` | qdrant | retrieve only this quality law |
| `@exact-source` | `payload.loads.source.targetFiles` | exact-source | inspect or mutate only approved targets |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
