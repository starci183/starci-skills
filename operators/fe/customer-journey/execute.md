# Execute `fe/customer-journey`

This operator derives three or four materially different end-to-end customer journeys from a fresh, approved business projection, recommends exactly one, and applies the declared manual or auto-recommended selection policy. Everything remains inside the task session.

## Step 1 — Validate and freeze the invocation

**Read:** the complete input object only.
**Context:** none; do not resolve any binding before validation succeeds.
**Decision evidence:** accepted `stage/status`, required and forbidden facts, task ownership of every session URI, and orchestration profile identity.
**Action:** run `validate-input.mjs` and freeze the route, provided references, load declarations, and session slots.
**Session write:** the validated envelope at `payload.session.inputRef`.
**Durable write:** none.
**Stop:** emit the operator's blocked or refusal decision when validation fails; a single-outcome operator stops the parent skill as invalid input rather than inventing another route.
**Orchestration:** coordinator only.

## Step 2 — Load business authority

**Read:** `payload.loads.business` and `payload.provided.businessHeadRef`.
**Context:** load only the journey projection at the declared revision under `.worktrees/<project>/businesses/`; never infer business behavior from frontend source.
**Decision evidence:** fresh-receipt equality, projection revision, actor, trigger, terminal outcome, transitions, rules, and recovery constraints.
**Action:** normalize only the applicable journey slice.
**Session write:** projection bindings under `scratchPrefix/business-projection`; do not copy the complete business tree.
**Durable write:** none.
**Stop:** stop when the business head is missing, stale, rejected, or does not equal the provided reference.
**Orchestration:** coordinator owns authority selection; workers cannot choose another business head.

## Step 3 — Resolve upstream, knowledge, and source capability

**Read:** `payload.loads.upstream`, `payload.loads.knowledge`, and every source binding declared by this schema.
**Context:** resolve only preflight and business-freshness receipts plus optional flow feedback. Retrieve only `fe.customer-journey` at its pinned hash. This operator has no frontend capability or repository-file binding.
**Decision evidence:** upstream identity and revision matches, knowledge generation matches, and every requested capability or exact target is inside the frozen boundary.
**Action:** create a minimal constraint set containing IDs, revisions, applicable rules, target permissions, and required outcomes.
**Session write:** normalized constraints at `scratchPrefix/constraints`.
**Durable write:** none.
**Stop:** stop when actor goal, terminal outcome, or a required business transition lacks authority.
**Orchestration:** bindings are resolved once by the coordinator and passed to workers as minimal read-only slices.

## Step 4 — Perform the operator decision

**Read:** normalized business and authority constraints plus only the exact source-capability records or targets declared above.
**Context:** do not load another feature, knowledge record, contract generation, file, service, or provider target.
**Decision evidence:** normalize actor, trigger, goal, ordered decisions, failure recovery, and terminal outcome. Produce exactly the requested three or four directions that differ in sequencing, decision timing, recovery, or page boundaries—never cosmetic presentation.
**Action:** execute that classification or preparation and attach evidence by stable input identity; record applied rules and observable conclusions, never hidden reasoning.
**Session write:** a normalized draft at `scratchPrefix/customer-journey-draft`.
**Durable write:** none at this step.
**Stop:** stop when actor goal, terminal outcome, or a required business transition lacks authority.
**Orchestration:** in economical mode the coordinator drafts sequentially; in balanced or parallel mode workers may draft from the same minimal projection. The coordinator joins, deduplicates, and retains exactly three or four material directions.

## Step 5 — Verify and commit the accepted result

**Read:** the normalized draft, joined worker observations, frozen constraints, and expected emitted facts.
**Context:** no new context may be loaded during verification.
**Decision evidence:** Trace every direction from entry to terminal outcome, prove all business rules and recovery points are covered, and reject any direction that compresses a genuine multi-page journey into tabs.
**Action:** validate completeness and rank all directions by evidenced fit, recoverability, risk, and implementation cost. Recommend exactly one. Under `manual`, emit pending with no selected ref. Under `auto-recommended`, bind only the recommendation to `selectedJourneyRef` and emit approved.
**Session write:** accepted evidence and before/after descriptors under `scratchPrefix/accepted-result`.
**Durable write:** None. The accepted result remains a task-session value.
**Stop:** stop when actor goal, terminal outcome, or a required business transition lacks authority.
**Orchestration:** coordinator-only join and commit; workers remain read/analyze-only and cannot mutate source or external systems.

## Step 6 — Emit output and register terminal cleanup

**Read:** accepted result, minimal context lineage, emitted facts, and all allocated scratch references.
**Context:** references and revisions actually used only; omit copied documents, prompts, worker transcripts, and reasoning.
**Decision evidence:** selected decision exactly matches one manifest emit, `payload.state`, root stage/status, and facts additions/removals.
**Action:** construct `output.schema.json`, validate it with `validate-output.mjs`, and place it at `payload.session.outputRef`.
**Session write:** output, evidence refs, and complete cleanup inventory.
**Durable write:** none.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** the coordinator emits once. At every parent-skill terminal, purge input, output, loaded bindings, worker observations, drafts, evidence, and receipts.
