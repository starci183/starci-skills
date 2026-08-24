# Execute `workspace/bootstrap-verify`

This operator verifies bootstrap entry files and agent discovery before declaration compilation. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze the route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if the schema, accepted route, facts, or session ownership fails.

## Step 2 — Resolve exact bindings

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve exact task-session artifacts and retrieve only `workspace.initialization` from its pinned Qdrant generation.
**Analysis:** verify identity, revision, freshness, and ownership. Record applied rule IDs and match/mismatch evidence, never hidden reasoning.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when a binding is missing, stale, ambiguous, or outside the accepted route.

## Step 3 — Perform the operator decision

**Read:** validated bindings, and accepted machine facts.
**Context:** use no undeclared knowledge, business feature, artifact, or source file.
**Decision criteria:** identity, bootstrap entry, and source index identify one workspace.
**Analysis:** inspect every declared bootstrap entry and reject stale or cross-workspace bindings. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Route:** emit `ready` when all bootstrap entries and their hashes match; emit `initialize-required` for missing or stale rebuildable bootstrap/index declarations; emit `blocked` for cross-workspace identity, ambiguous ownership, unsafe paths, or corrupt authority.
**Session write:** candidate `bootstrapReceiptRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced or parallel mode may delegate independent read-only comparisons. Each worker receives only assigned refs; the coordinator owns joining and the decision.
**Stop:** never repair declarations or indexes inside this read-only verifier.

## Step 4 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the candidate is closed, traceable, route-compatible, and free of copied context or reasoning transcripts.
**Session write:** accepted artifact at `payload.session.scratchPrefix/bootstrapReceiptRef` and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence or broaden scope.

## Step 5 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
