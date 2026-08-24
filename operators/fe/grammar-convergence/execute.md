# Execute `fe/grammar-convergence`

This operator's responsibility is to bind an approved layout to the locked Grammar packages and refuse business semantics inside Grammar. Its input, output, loaded bindings, worker observations, drafts, and evidence exist only inside the current task session.

## Step 1 — Validate and freeze the invocation

**Read:** the complete input object only.
**Context:** none; do not resolve any binding before validation succeeds.
**Decision evidence:** accepted `stage/status`, required and forbidden facts, task ownership of every session URI, and orchestration profile identity.
**Action:** run `validate-input.mjs` and freeze the route, provided references, load declarations, and session slots.
**Session write:** the validated envelope at `payload.session.inputRef`.
**Durable write:** none.
**Stop:** emit the operator's blocked or refusal decision when validation fails; a single-outcome operator stops the parent skill as invalid input rather than inventing another route.
**Orchestration:** coordinator only.

## Step 2 — Prove business isolation

**Read:** approved layout and neutral fact-model session refs only.
**Context:** IDs, revisions, and neutral presentation states; do not load a business document, actor, entity, policy, outcome, or source file.
**Decision evidence:** approval equality, neutral-state ownership, and absence of business-named Grammar state.
**Action:** freeze the business-free boundary that all later Grammar resolution must preserve.
**Session write:** isolation proof under `scratchPrefix/business-isolation`.
**Durable write:** none.
**Stop:** refuse when a business semantic enters Grammar or the neutral fact model is missing/stale.
**Orchestration:** coordinator only.

## Step 3 — Resolve upstream, knowledge, and source capability

**Read:** `payload.loads.upstream`, `payload.loads.knowledge`, and every source binding declared by this schema.
**Context:** resolve only the approved layout, neutral fact model, exact npm lock, installed package manifest/public export map, applicable package-contract hashes, and effective application-contract candidates. Load Common overview/contracts, the selected Grammar overview, and only the object or specifically named case guides whose triggers match the layout. Never load guides from the unselected Grammar. Resolve `payload.loads.frontendSource` only as the hash-pinned plain-JSON application-contract snapshot. Never load raw repository material, package source, or unrelated guide sections.
**Decision evidence:** npm package name, exact version, integrity, manifest/export identity, contract hash, upstream revision, guide hash, and every requested capability inside the frozen boundary.
**Action:** create a minimal constraint set that distinguishes executable npm authority, usage guidance, and application-owned composition. If the guide and installed package disagree, the package remains authoritative and convergence stops until the guide is corrected.
**Session write:** normalized constraints at `scratchPrefix/constraints`.
**Durable write:** none.
**Stop:** refuse on business-specific Grammar content, an unlocked package, a missing neutral owner, or an undeclared package dependency.
**Orchestration:** bindings are resolved once by the coordinator and passed to workers as minimal read-only slices.

## Step 4 — Perform the operator decision

**Read:** normalized Grammar authority constraints plus only the exact application-contract candidates declared above.
**Context:** do not load another feature, knowledge record, contract generation, file, service, or provider target.
**Decision evidence:** Resolve every candidate first against `@starci/grammar/common`, then against exactly `@starci/grammar/core` or `@starci/grammar/offset-pop` as selected. Apply that package's object guide and each matching named-case guide. Verify the exact public export, layer, effective contract, neutral states, labels, dependencies, and declared extension axes. Keep all business meaning outside Grammar.
**Action:** classify each requirement as `reuse`, `extend`, or `grammar-gap`. Reuse exact public exports; extend only an explicitly open contract axis; emit a package request instead of fabricating a lower-tier component, deep import, wrapper, prop, or state.
**Session write:** a normalized draft at `scratchPrefix/grammar-convergence-draft`.
**Durable write:** none at this step.
**Stop:** refuse on business-specific Grammar content, an unlocked package, a missing neutral owner, or an undeclared package dependency.
**Orchestration:** Workers may evaluate disjoint Block identities read-only. The coordinator joins by Grammar owner and refuses conflicting ownership or package versions.

## Step 5 — Verify and commit the accepted result

**Read:** the normalized draft, joined worker observations, frozen constraints, and expected emitted facts.
**Context:** no new context may be loaded during verification.
**Decision evidence:** Prove every resolved capability exists in the pinned npm export map, every extension stays on a declared axis, every state is neutral, no business element entered Grammar, and the effective application contract remains compatible.
**Action:** validate completeness, conflict freedom, boundary compliance, and decision-to-route mapping. The coordinator rejects missing worker IDs or conflicting observations before any effect.
**Session write:** accepted evidence and before/after descriptors under `scratchPrefix/accepted-result`.
**Durable write:** None. The accepted result remains a task-session value.
**Stop:** refuse on business-specific Grammar content, an unlocked package, a missing neutral owner, or an undeclared package dependency.
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

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@upstream` | `payload.loads.upstream` | session | resolve only the accepted upstream artifacts |
| `@grammar-common-overview` | `fe.grammar-common-overview` | qdrant | always load the shared routing and ownership rules |
| `@grammar-common-contracts` | `fe.grammar-common-contracts` | qdrant | always load exact object-contract resolution rules |
| `@grammar-common-states` | `fe.grammar-common-states-accessibility` | qdrant | load for stateful or interactive objects |
| `@grammar-common-extension` | `fe.grammar-common-extension` | qdrant | load for reuse, extension, or missing capability decisions |
| `@grammar-common-surface-inside-surface` | `fe.grammar-common-case-surface-inside-surface` | qdrant | load only for a nested surface boundary |
| `@grammar-common-collection-cardinality` | `fe.grammar-common-case-collection-cardinality` | qdrant | load only for repeated zero/one/many content |
| `@grammar-common-sticky-scroll-owner` | `fe.grammar-common-case-sticky-scroll-owner` | qdrant | load only for sticky or multiple-scroll decisions |
| `@grammar-common-responsive-flattening` | `fe.grammar-common-case-responsive-flattening` | qdrant | load only when responsive design changes a surface boundary |
| `@grammar-core-overview` | `fe.grammar-core-overview` | qdrant | load only when `grammarId` is `core` |
| `@grammar-core-actions` | `fe.grammar-core-object-actions` | qdrant | Core action objects only |
| `@grammar-core-fields` | `fe.grammar-core-object-fields` | qdrant | Core field objects only |
| `@grammar-core-surface-card` | `fe.grammar-core-object-surface-card` | qdrant | Core SurfaceCard only |
| `@grammar-core-collections` | `fe.grammar-core-object-collections` | qdrant | Core collections only |
| `@grammar-core-navigation` | `fe.grammar-core-object-navigation` | qdrant | Core navigation only |
| `@grammar-core-tabs` | `fe.grammar-core-object-tabs` | qdrant | Core tabs only |
| `@grammar-core-tables` | `fe.grammar-core-object-tables` | qdrant | Core dense comparison only |
| `@grammar-core-overlays-feedback` | `fe.grammar-core-object-overlays-feedback` | qdrant | Core overlays or feedback only |
| `@grammar-core-primary-secondary-grid` | `fe.grammar-core-case-primary-secondary-grid` | qdrant | Core weighted-column layout only |
| `@grammar-core-trust-list-in-card` | `fe.grammar-core-case-trust-list-in-card` | qdrant | Core trustworthy nested list only |
| `@grammar-core-multi-step-form` | `fe.grammar-core-case-multi-step-form` | qdrant | Core multi-page form journey only |
| `@grammar-core-sticky-summary` | `fe.grammar-core-case-sticky-summary` | qdrant | Core long-content sticky summary only |
| `@grammar-offset-pop-overview` | `fe.grammar-offset-pop-overview` | qdrant | load only when `grammarId` is `offset-pop` |
| `@grammar-offset-pop-actions` | `fe.grammar-offset-pop-object-actions` | qdrant | Offset Pop action objects only |
| `@grammar-offset-pop-fields` | `fe.grammar-offset-pop-object-fields` | qdrant | Offset Pop field objects only |
| `@grammar-offset-pop-surface-card` | `fe.grammar-offset-pop-object-surface-card` | qdrant | Offset Pop SurfaceCard only |
| `@grammar-offset-pop-collections` | `fe.grammar-offset-pop-object-collections` | qdrant | Offset Pop collections only |
| `@grammar-offset-pop-navigation` | `fe.grammar-offset-pop-object-navigation` | qdrant | Offset Pop navigation only |
| `@grammar-offset-pop-tabs` | `fe.grammar-offset-pop-object-tabs` | qdrant | Offset Pop tabs only |
| `@grammar-offset-pop-tables` | `fe.grammar-offset-pop-object-tables` | qdrant | Offset Pop dense comparison only |
| `@grammar-offset-pop-overlays-feedback` | `fe.grammar-offset-pop-object-overlays-feedback` | qdrant | Offset Pop overlays or feedback only |
| `@grammar-offset-pop-hero-collage` | `fe.grammar-offset-pop-case-hero-collage` | qdrant | Offset Pop hero collage only |
| `@grammar-offset-pop-list-in-card` | `fe.grammar-offset-pop-case-list-in-offset-card` | qdrant | Offset Pop nested list only |
| `@grammar-offset-pop-dense-screen` | `fe.grammar-offset-pop-case-dense-screen-simplification` | qdrant | Offset Pop dense screen simplification only |
| `@grammar-offset-pop-mobile-accent` | `fe.grammar-offset-pop-case-mobile-accent-reduction` | qdrant | Offset Pop narrow-screen accent reduction only |
| `@frontend-contracts` | `payload.loads.frontendSource` | fe-contract-generation | query only hash-pinned plain JSON contract records |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select bounded sequential or read-only fan-out execution |
