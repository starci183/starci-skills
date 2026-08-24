# Execute `quality/finding-repair`

This operator repairs one approved readiness finding. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Revalidate finding and approval

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve only the approved finding, baseline, owner boundary, approval revision, and `quality.readiness-repair`.
**Analysis:** verify `payload.scope` names one finding, its fingerprint still exists at the same baseline, the approval fingerprint names this exact finding and permitted writes, `targetCount` matches, and owner/proof-plan identities are unchanged.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** a missing or changed finding is stale and must return to inventory without mutation. Missing approval, expired approval, ambiguous owner, or foreign revision blocks.

## Step 3 — Inspect the exact repair targets

**Read:** only `payload.loads.source.targetFiles`.
**Context:** broad scans, undeclared paths, and indexed source summaries are forbidden.
**Analysis:** verify each before hash, allowed repair, owner, and debt/finding relevance.
**Session write:** `scratchPrefix/source-checks/<worker-id>`.
**Orchestration:** read-only workers may inspect disjoint files; the coordinator validates and joins all observations. Workers never write source.
**Stop:** do not mutate when a hash changed. Return stale to inventory if the finding was superseded; emit boundary drift only when the correct fix inherently needs a different approved owner or target.

## Step 4 — Compile the minimal repair

**Read:** validated bindings, joined source checks, and accepted machine facts.
**Context:** load no undeclared knowledge, source, or business feature.
**Decision criteria:** every planned change belongs to the owner boundary and directly addresses the measured finding without weakening its proving gate.
**Analysis:** create one exact patch plan with before hashes, expected after invariants, and the narrow gate that must remove the finding during the following inventory. Do not mutate in this step.
**Session write:** candidate patch plan and typed `decisionProof` at `scratchPrefix/candidate`; every branch records the finding, approval, and observed-baseline fingerprints.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit only one declared decision and never widen a repair boundary.

## Step 5 — Apply the approved repair

**Read:** exact targets, validated candidate, and approved mutation scope.
**Context:** coordinator only. Workers do not write source or durable authority.
**Action:** recheck before hashes immediately before write, then mutate only declared exact files and permitted responsibilities, preserving unrelated changes. Produce `repairReceiptRef` plus `decisionProof(kind=mutation-applied, changedTargets>0, reinventoryRequired=true)`. Do not claim the finding is cleared until the parent reinventory confirms it.
**Durable write:** approved product-source files only. This one-finding operator never creates or edits a debt record.
**Session write:** before/after hashes at `scratchPrefix/mutations`.
**Stop:** emit boundary drift or blocked if correct repair needs another file, responsibility, or authority.

## Step 6 — Emit and register cleanup

**Read:** candidate, decision evidence, lineage, and mutation hashes.
**Context:** return refs and revisions only, not loaded content, full command logs, prompts, or observations.
**Action:** construct `output.schema.json`; align decision, typed proof, state, root route, and emitted facts; run `validate-output.mjs`. Non-repair outcomes must have zero changed targets and zero durable writes.
**Session write:** `payload.session.outputRef`; list all scratch refs in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediate session objects at the parent terminal.
