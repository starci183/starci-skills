# Execute `architecture/source-discovery`

This operator resolves exact backend files for the approved scope. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze the route, provided refs, load declarations, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if the schema, accepted route, facts, or session ownership fails.

## Step 2 — Resolve exact bindings

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`, and `payload.loads.business`.
**Context:** resolve exact task-session artifacts and retrieve only `be.boundary-planning` from its pinned Qdrant generation. Load only the declared business revision under `.worktrees/<project>/businesses/`.
**Analysis:** verify identity, revision, freshness, and ownership. Record applied rule IDs and match/mismatch evidence, never hidden reasoning.
**Session write:** `payload.session.scratchPrefix/bindings`.
**Stop:** stop when a binding is missing, stale, ambiguous, or outside the accepted route.

## Step 3 — Inspect exact source files

**Read:** only `payload.loads.source.targetFiles`.
**Context:** broad repository scans, undeclared paths, and indexed source summaries are forbidden.
**Analysis:** verify each hash and extract only evidence required to resolve exact backend files for the approved scope. In a monorepo, trace every affected flow from ingress through the owning deployable app/process, local persistence and side effects, then through any callback, polling or reconciliation edge. Repository folders, shared libraries, product names and terms such as `core`, `controller` or `control plane` are not ownership evidence.
**Session write:** `payload.session.scratchPrefix/source-observations/<worker-id>`.
**Orchestration:** balanced or parallel mode may fan out disjoint read-only files. The coordinator validates and joins all observations. Workers never write source.
**Stop:** stop on hash drift, unresolved ownership, an untraced runtime hop, or a need to inspect another file.

## Step 4 — Perform the operator decision

**Read:** validated bindings, joined exact-source observations, and accepted machine facts.
**Context:** use no undeclared knowledge, business feature, artifact, or source file.
**Decision criteria:** each selected file has role, hash, relevance reason, partition provenance, deployable owner and its place in the end-to-end runtime flow.
**Analysis:** resolve exact files from routed partition evidence without broad repository loading. The source receipt must distinguish configuration/control ownership from runtime execution and data ownership, name every process/database boundary crossed, and identify the transport and direction at each boundary. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Session write:** candidate `sourceReceiptRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced or parallel mode may delegate independent read-only comparisons. Each worker receives only assigned refs; the coordinator owns joining and the decision.
**Stop:** emit only a declared decision when evidence is missing, contradictory, or outside scope.

## Step 5 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the candidate is closed, traceable, route-compatible, and free of copied context or reasoning transcripts.
**Session write:** accepted artifact at `payload.session.scratchPrefix/sourceReceiptRef` and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence or broaden scope.

## Step 6 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
