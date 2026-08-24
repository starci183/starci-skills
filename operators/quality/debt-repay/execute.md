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
**Analysis:** verify debt identity, exact approval receipt and fingerprint, expiry, current open/closed inventory revision, baseline metric, closure criterion, permitted writes, prior-iteration fingerprint, and remaining iteration budget.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** block on missing/stale/expired approval, closed-or-missing inventory identity, ambiguous owner, foreign revision, repeated iteration fingerprint, or exhausted budget before reading source. `intent: close` additionally requires an independent green closure proof.

## Step 3 — Branch by intent

**Read:** for `repay`, only `payload.loads.source.targetFiles`; for `close`, no source files and only the independent proof plus debt inventory projection.
**Context:** broad scans, undeclared paths, indexed source summaries, and source reads during close are forbidden.
**Analysis:** for repay, verify every before hash, allowed repair, owner, and debt relevance. For close, verify proof result, evidence hash, independent verifier identity, debt revision, and inventory compare-and-swap baseline.
**Session write:** `scratchPrefix/source-checks/<worker-id>`.
**Orchestration:** read-only workers may inspect disjoint files; the coordinator validates and joins all observations. Workers never write source.
**Stop:** block before mutation when a hash, owner, target, proof, or inventory revision is invalid. Close cannot widen scope or alter source.

## Step 4 — Evaluate the result

**Read:** validated bindings, joined source checks, and accepted machine facts.
**Context:** load no undeclared knowledge, source, or business feature.
**Decision criteria:** each repayment mutation is inside scope and measured exit criteria prove strict progress; closure finalization has independent green proof and an atomic closed-inventory plan.
**Analysis:** for repay, compile one bounded patch plan and predicted measurement. `progress` requires a new fingerprint and strict improvement; reaching the criterion emits `closure-candidate`, never `closed`. For close, compile only debt-record and closed-inventory updates bound to the independent proof hash. Do not mutate in this step.
**Session write:** candidate `debtReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit only one declared decision and never widen a repair boundary.

## Step 5 — Apply the approved repair

**Read:** exact targets, validated candidate, and approved mutation scope.
**Context:** coordinator only. Workers do not write source or durable authority.
**Action:** for repay, recheck hashes, apply only approved exact files, measure, and update the open debt record. Emit `progress` or `closure-candidate`; if no strict progress, restore only this operator's exact before-images after a no-drift check and block. For close, perform no source write: atomically mark the debt closed and append/update the closed inventory using compare-and-swap, binding the independent evidence hash.
**Durable write:** repay may write approved product source plus the open debt record. Close may write only the debt authority and closed debt inventory.
**Session write:** before/after hashes at `scratchPrefix/mutations`.
**Stop:** emit boundary drift or blocked if correct repair needs another file, responsibility, or authority.

## Step 6 — Emit and register cleanup

**Read:** candidate, decision evidence, lineage, and mutation hashes.
**Context:** return refs and revisions only, not loaded content, full command logs, prompts, or observations.
**Action:** construct `output.schema.json`; align decision, approval fingerprint, loop proof, closure artifacts, state, root route, and emitted facts; run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list all scratch refs in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediate session objects at the parent terminal.
