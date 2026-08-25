# Execute `workspace/routes-hydrate`

This operator hydrates machine-local routes from portable declarations. Input, output, context bindings, analysis evidence, worker observations, and receipts remain in task-session memory and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** the complete input envelope only.
**Context:** none; resolve no binding before validation succeeds.
**Action:** run `validate-input.mjs` and freeze the route, provided refs, load declarations, and session slots. On re-entry, bind the latest `routeInitializationEvidenceRef` and reuse the original same-task declaration and repository-map refs.
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
**Decision criteria:** each local repository mapping resolves once within declared roots.
**Analysis:** invoke `scripts/workspace-portable.mjs bootstrap --plan` for the selected project, then materialize and verify approved local route bindings. A missing declared sibling checkout is safely initializable; an existing path with mismatched Git identity is blocked. A re-entry is allowed only when route evidence classifies the drift as safely hydratable. Record evidence, criteria, and conclusions only; never record chain-of-thought.
**Session write:** candidate `hydrationReceiptRef` at `payload.session.scratchPrefix/candidate`.
**Orchestration:** economical mode is sequential. Balanced or parallel mode may delegate independent read-only comparisons. Each worker receives only assigned refs; the coordinator owns joining and the decision.
**Stop:** emit `blocked` for missing checkout, root escape, origin mismatch, branch mismatch, missing context, or contradictory evidence. Never repair a declaration or checkout here.

## Step 4 — Validate the candidate

**Read:** candidate artifact, decision evidence, and exact context lineage.
**Context:** no new load is allowed.
**Analysis:** prove the complete hydration plan was computed before any write and is closed, traceable, route-compatible, and free of copied context or reasoning transcripts.
**Session write:** accepted artifact at `payload.session.scratchPrefix/hydrationReceiptRef` and evidence under `scratchPrefix/evidence`.
**Stop:** do not invent evidence or broaden scope.

## Step 5 — Apply the declared durable effect

**Read:** validated candidate and the exact authority/write boundary.
**Context:** coordinator only; workers do not write source, worktrees, workspace declarations, or provenance heads.
**Decision criteria:** the effect is required for a successful decision, remains inside the declared owner, and preserves unrelated changes.
**Action:** run the exact helper with `bootstrap --apply`, then `check`. When the Source exposes a decrypted local checkout token, bind it only through `--credential-file <Source-relative-path>`. The helper may clone only an absent declared sibling at its exact origin and branch, and may atomically write changed ignored machine-local route state; it never persists the token, writes an authenticated remote URL, or replaces an existing path.
**Durable write:** approved authority/product result only. Never persist input, output, scratch, prompts, analysis, observations, or receipts.
**Session write:** before/after durable refs at `scratchPrefix/durable-effect`.
**Stop:** use `blocked` if identity, freshness, ownership, helper verification, or atomicity fails. No partial write is allowed.

## Step 6 — Emit and register cleanup

**Read:** accepted candidate, decision, evidence refs, lineage, and any durable-effect refs.
**Context:** return refs and revisions only, not loaded content or worker prompts.
**Action:** construct `output.schema.json`, align `payload.decision`, `payload.state`, root route, and emitted facts, then run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; list every scratch ref in `payload.cleanup.scratchRefs`.
**Stop:** do not emit an invalid or partially joined result.
**Orchestration:** coordinator validates the final output and purges all intermediate session objects when the parent skill terminates.
