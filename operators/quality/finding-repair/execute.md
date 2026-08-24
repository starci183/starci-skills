# Execute `quality/finding-repair`

This operator repairs one approved readiness finding. Input, output, loaded context, command captures, diagnostics, observations, and receipts remain session-only and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, route, facts, or task ownership fails.

## Step 2 — Resolve exact evidence and quality law

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve exact session artifacts and retrieve only `quality.readiness-repair` from its pinned generation.
**Analysis:** verify refs, revisions, ownership, and freshness. Record rule IDs and match/mismatch evidence only.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when evidence is stale, ambiguous, incomplete, or belongs to another revision.

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
**Decision criteria:** every changed file belongs to the owner boundary and directly clears the finding.
**Analysis:** apply the smallest exact-source change and prove the finding is removed. Record applied criteria, structured diagnostics, and conclusions only; never record chain-of-thought.
**Session write:** candidate `repairReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced/parallel modes may classify independent evidence items read-only; the coordinator owns route classification and join.
**Stop:** emit only one declared decision and never widen a repair boundary.

## Step 5 — Apply the approved repair

**Read:** exact targets, validated candidate, and approved mutation scope.
**Context:** coordinator only. Workers do not write source or durable authority.
**Action:** mutate only declared exact files and permitted responsibilities, preserving unrelated changes.
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
