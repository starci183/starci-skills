# Execute `fe/maintenance-apply`

This operator's responsibility is to apply an approved frontend maintenance correction inside its exact source boundary. Its input, output, loaded bindings, worker observations, drafts, and evidence exist only inside the current task session.

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
**Context:** load exactly the declared revision under `.worktrees/<project>/businesses/`; never infer business behavior from frontend source.
**Decision evidence:** reference equality, revision hash, accepted business status, and the specific facts needed to apply an approved frontend maintenance correction inside its exact source boundary.
**Action:** normalize only the applicable actor, outcome, rule, state, and constraint references.
**Session write:** value-safe business bindings under `scratchPrefix/business`; do not copy the complete business document into output.
**Durable write:** none.
**Stop:** stop when the business head is missing, stale, rejected, or does not equal the provided reference.
**Orchestration:** coordinator owns authority selection; workers cannot choose another business head.

## Step 3 — Resolve upstream, knowledge, and source capability

**Read:** `payload.loads.upstream`, `payload.loads.knowledge`, and every source binding declared by this schema.
**Context:** resolve only approved maintenance decision, source boundary, and acceptance proof. Retrieve only the listed knowledge IDs at their pinned content hashes. Resolve `payload.loads.frontendSource` only: the hash-pinned plain-JSON contract snapshot, generator fingerprint, selected query IDs, and pinned index generation. Never load raw repository material or broaden the contract query. Resolve only `exactTargets` after validating repository-relative paths and SHA-256 values.
**Decision evidence:** upstream identity and revision matches, knowledge generation matches, and every requested capability or exact target is inside the frozen boundary.
**Action:** create a minimal constraint set containing IDs, revisions, applicable rules, target permissions, and required outcomes.
**Session write:** normalized constraints at `scratchPrefix/constraints`.
**Durable write:** none.
**Stop:** stop on stale targets, boundary expansion, owner substitution, missing acceptance criterion, or a correction that requires a new authority decision.
**Orchestration:** bindings are resolved once by the coordinator and passed to workers as minimal read-only slices.

## Step 4 — Perform the operator decision

**Read:** normalized business and authority constraints plus only the exact source-capability records or targets declared above.
**Context:** do not load another feature, knowledge record, contract generation, file, service, or provider target.
**Decision evidence:** Translate the accepted correction into target-specific changes while preserving Block anatomy, Grammar ownership, business behavior, and unrelated user work.
**Action:** execute that classification or preparation and attach evidence by stable input identity; record applied rules and observable conclusions, never hidden reasoning.
**Session write:** a normalized draft at `scratchPrefix/maintenance-apply-draft`.
**Durable write:** none at this step.
**Stop:** stop on stale targets, boundary expansion, owner substitution, missing acceptance criterion, or a correction that requires a new authority decision.
**Orchestration:** Workers may inspect disjoint targets and states read-only. The coordinator joins by target path and shared Block identity and alone writes source.

## Step 5 — Verify and commit the accepted result

**Read:** the normalized draft, joined worker observations, frozen constraints, and expected emitted facts.
**Context:** no new context may be loaded during verification.
**Decision evidence:** Recheck target hashes, apply the minimal patch, and verify the stated observable correction in every declared state and viewport.
**Action:** validate completeness, conflict freedom, boundary compliance, and decision-to-route mapping. The coordinator rejects missing worker IDs or conflicting observations before any effect.
**Session write:** accepted evidence and before/after descriptors under `scratchPrefix/accepted-result`.
**Durable write:** The coordinator writes only the exact approved targets after a final hash check; no receipt or draft is durable.
**Stop:** stop on stale targets, boundary expansion, owner substitution, missing acceptance criterion, or a correction that requires a new authority decision.
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
