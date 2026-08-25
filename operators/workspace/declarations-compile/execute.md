# Execute `workspace/declarations-compile`

This operator compiles portable workspace declarations. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

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
**Decision criteria:** the declaration set is closed, portable, free of machine-local secrets, and passes `workspace-multidevice-commit-boundary-v1`: every portable declaration is tracked while hydrated routes, worktree containers, references and session state are ignored by the Source repository.
**Analysis:** normalize project, role, port, and route declarations. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Session write:** candidate `compiledDeclarationsRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced or parallel mode may delegate independent read-only comparisons. Each worker receives only assigned refs; the coordinator owns joining and the decision.
**Stop:** emit only a declared decision when evidence is missing, contradictory, or outside scope.

## Step 4 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the candidate is closed, traceable, route-compatible, and free of copied context or reasoning transcripts.
**Session write:** accepted artifact at `payload.session.scratchPrefix/compiledDeclarationsRef` and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence or broaden scope.

## Step 5 — Apply the declared durable effect

**Read:** validated candidate and the exact authority/write boundary.
**Context:** coordinator only; workers do not write source, worktrees, workspace declarations, or provenance heads.
**Decision criteria:** the effect is required for a successful decision, remains inside the declared owner, and preserves unrelated changes.
**Action:** apply only this declared effect: write tracked portable workspace declarations only.
**Durable write:** approved authority/product result only. Never persist input, output, scratch, prompts, analysis, observations, or receipts.
**Session write:** before/after durable refs at `scratchPrefix/durable-effect`.
**Stop:** use the declared blocked/revision decision if identity, freshness, ownership, or atomicity fails.

## Step 6 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
