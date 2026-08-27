# Execute `fe/layout`

This operator's responsibility is to compose approved journeys, pages, states, and available frontend Blocks into complete responsive layout directions. Its input, output, loaded bindings, worker observations, drafts, and evidence exist only inside the current task session.

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
**Decision evidence:** reference equality, revision hash, accepted business status, and the specific facts needed to compose approved journeys, pages, states, and available frontend Blocks into complete responsive layout directions.
**Action:** normalize only the applicable actor, outcome, rule, state, and constraint references.
**Session write:** value-safe business bindings under `scratchPrefix/business`; do not copy the complete business document into output.
**Durable write:** none.
**Stop:** stop when the business head is missing, stale, rejected, or does not equal the provided reference.
**Orchestration:** coordinator owns authority selection; workers cannot choose another business head.

## Step 3 — Resolve upstream, knowledge, and source capability

**Read:** `payload.loads.upstream`, `payload.loads.knowledge`, and every source binding declared by this schema.
**Context:** resolve only approved flow, page model, state model, and Block ownership set. Retrieve only the listed knowledge IDs at their pinned content hashes. Resolve `payload.loads.frontendSource` only: the hash-pinned plain-JSON contract snapshot, generator fingerprint, selected query IDs, and pinned index generation. Never load raw repository material or broaden the contract query.
**Decision evidence:** upstream identity and revision matches, knowledge generation matches, and every requested capability or exact target is inside the frozen boundary.
**Action:** create a minimal constraint set containing IDs, revisions, applicable rules, target permissions, and required outcomes.
**Session write:** normalized constraints at `scratchPrefix/constraints`.
**Durable write:** none.
**Stop:** stop on a missing Block owner, stale approved hash, incomplete journey page, or fewer than two materially different requested directions.
**Orchestration:** bindings are resolved once by the coordinator and passed to workers as minimal read-only slices.

## Step 4 — Perform the operator decision

**Read:** normalized business and authority constraints plus only the exact source-capability records or targets declared above.
**Context:** do not load another feature, knowledge record, contract generation, file, service, or provider target.
**Decision evidence:** For every page, order Blocks by user task and information weight; assign grid spans, density, sticky behavior, progressive disclosure, responsive transformation, and one global journey-progress owner when required.
**Action:** execute that classification or preparation and attach evidence by stable input identity; record applied rules and observable conclusions, never hidden reasoning. Build one accessible interactive HTML comparison for every direction and all three responsive states, with the recommended direction useful on first render and each exact `OK LAYOUT <id>` command visible. Bind it to `payload.reviewPreview` with renderer `visualize`; a prose summary or static code block is not a preview.
**Session write:** a normalized draft at `scratchPrefix/layout-draft` and the HTML review artifact at `scratchPrefix/layout-review.html`.
**Durable write:** none at this step.
**Stop:** stop on a missing Block owner, stale approved hash, incomplete journey page, fewer than two materially different requested directions, or inability to produce the interactive `visualize` review artifact.
**Orchestration:** Workers may compose disjoint pages from the same journey and contract generation. The coordinator joins through global navigation, progress, shared Block ownership, and responsive invariants.

## Step 5 — Verify and commit the accepted result

**Read:** the normalized draft, joined worker observations, frozen constraints, and expected emitted facts.
**Context:** no new context may be loaded during verification.
**Decision evidence:** Render a complete direction graph for wide, intermediate, and compact states; prove every Block has a purpose, data owner, state coverage, and source-capability verdict. Verify the HTML artifact renders all direction IDs, the recommended direction, responsive controls, and exact approval commands.
**Action:** validate completeness, conflict freedom, boundary compliance, decision-to-route mapping, and the `reviewPreview` correlations enforced by `validate-output.mjs`. The coordinator rejects missing worker IDs, conflicting observations, or a missing/unrenderable preview before any effect.
**Session write:** accepted evidence and before/after descriptors under `scratchPrefix/accepted-result`.
**Durable write:** None. The accepted result remains a task-session value.
**Stop:** stop on a missing Block owner, stale approved hash, incomplete journey page, or fewer than two materially different requested directions.
**Orchestration:** coordinator-only join and commit; workers remain read/analyze-only and cannot mutate source or external systems.

## Step 6 — Emit output and register terminal cleanup

**Read:** accepted result, minimal context lineage, emitted facts, and all allocated scratch references.
**Context:** references and revisions actually used only; omit copied documents, prompts, worker transcripts, and reasoning.
**Decision evidence:** selected decision exactly matches one manifest emit, `payload.state`, root stage/status, and facts additions/removals.
**Action:** construct `output.schema.json`, validate it with `validate-output.mjs`, and place it at `payload.session.outputRef`. Resolve `payload.reviewPreview.artifactRef` to its absolute executor-side HTML path, generate the content reference only with `node <Source>/.claude/scripts/visualize-directive.mjs <absolute-path>`, and paste the helper's stdout unchanged into the same review response. Never handwrite or interpolate the `visualize` JSON. The helper must normalize Windows separators to `/`, reject control characters such as interpreted `\\n`, `\\r`, or `\\t`, and prove JSON round-trip safety. Stop if the helper fails or the rendered preview is not visible; only after a visible render may the parent display the exact layout approval command and enter its wait.
**Session write:** output, evidence refs, and complete cleanup inventory.
**Durable write:** none.
**Stop:** do not emit an invalid or partially joined output.
**Orchestration:** the coordinator emits once. At every parent-skill terminal, purge input, output, loaded bindings, worker observations, drafts, evidence, and receipts.
