# Execute `architecture/current-state`

This operator captures decision-relevant current architecture. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze the route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if the schema, accepted route, facts, or session ownership fails.

## Step 2 — Resolve exact bindings

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** resolve exact task-session artifacts and retrieve only `architecture.decision-analysis` from its pinned Qdrant generation.
**Analysis:** verify identity, revision, freshness, and ownership. Record applied rule IDs and match/mismatch evidence, never hidden reasoning.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when a binding is missing, stale, ambiguous, or outside the accepted route.

## Step 3 — Inspect exact source files

**Read:** only `payload.loads.source.targetFiles`.
**Context:** broad repository scans, undeclared paths, and indexed source summaries are forbidden.
**Analysis:** verify each hash and extract only evidence required to capture decision-relevant current architecture.
**Session write:** `payload.session.scratchPrefix/source-observations/<worker-id>`.
**Orchestration:** balanced or parallel mode may fan out disjoint read-only files. The coordinator validates and joins all observations. Workers never write source.
**Stop:** stop on hash drift, unresolved ownership, or a need to inspect another file.

## Step 4 — Perform the operator decision

**Read:** validated bindings, joined exact-source observations, and accepted machine facts.
**Context:** use no undeclared knowledge, business feature, artifact, or source file.
**Decision criteria:** each included fact changes the decision and has exact artifact or file evidence.
**Analysis:** summarize topology, constraints, dependencies, and failure evidence. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Session write:** candidate `currentStateRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced or parallel mode may delegate independent read-only comparisons. Each worker receives only assigned refs; the coordinator owns joining and the decision.
**Stop:** emit only a declared decision when evidence is missing, contradictory, or outside scope.

## Step 5 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the candidate is closed, traceable, route-compatible, and free of copied context or reasoning transcripts.
**Session write:** accepted artifact at `payload.session.scratchPrefix/currentStateRef` and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence or broaden scope.

## Step 6 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
