---
name: starci-fe-design-layout
description: Design, stage-approve, implement, seed and prove one mature long page or end-to-end flow by synthesizing customer journey and business truth with component, contract and source capability. Approve page anatomy first, expand states second, then approve the exact source-and-seed boundary, code, seed the real local product and prove it.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | staged approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/en.md` | en | verified frontend route |
| `@worktrees` | `contexts/worktrees/en.md` | en | ignored session cache |
| `@composition` | `brainstorms/composition/en.md` | en | Scope, Owner, Invariant and Proof |
| `@business` | `contexts/business/en.md` | en | routed business truth |
| `@grammar` | `grammars` | module | product-family facts and owners |
| `@principles` | `compilers/principles` | module | visual decision audit |
| `@patterns-fe` | `compilers/patterns/fe` | module | source ownership |
| `@lints-fe` | `gates/fe/lints` | module | source proof |
| `@layouts` | `brainstorms/layouts/en.md` | en | schema 7 synthesis and staged contracts |
| `@design-review` | `publication/design-review-preview/en.md` | en | staged HTML review |
| `@contract-search` | `scripts/contract-search.mjs` | script | component contract evidence |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | routed grammar decisions |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | grammar proof |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | drift refusal |
| `@validate-layout-grammar` | `scripts/validate-layout-grammar.mjs` | script | exact child-target semantic owners |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | current visual vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | page/state boundary validation |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | composition proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | principle proof |
| `@maturity-schema` | `publication/design-review-preview/maturity.schema.json` | file | staged maturity evidence |
| `@validate-maturity` | `scripts/validate-design-maturity.mjs` | script | mature-page refusal gate |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | cache review publisher |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | final parity proof |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | source-write authority |

## NESTED SKILLS

None. Layout owns design through implementation and QA.

## Run

Confirm one `page` or explicit start-to-terminal `flow` scope. Resolve the routed frontend, business head, grammar, MASTER, contracts and current source. Create one ignored design session and validate the four-lock composition baseline.

### 1. Map pages before drawing

Enumerate every page in scope before either design track. Each page records id, route, actor, entry, customer
intent, decision, successful outcome, failure consequence and the closed render intents it must visibly
satisfy. A flow includes its start, every decision page and terminal page before regions are drawn.

### 2. Resolve from two independent directions

Top-down, write the customer actors, entries, goals, successful outcomes and ordered steps. Each step names intent, decision, action, consequence and its page. Bind all business rules, operations, entitlements, data owners and failure consequences to routed truth.

Bottom-up and contract-first, inspect the complete composition, components, contracts, data mappings,
responsive behavior, exact source owners and legacy/current nested visual owners without adapting this track
to proposed journey regions. Classify every region as `reuse`, `generalize` or `new-required`. Missing
capability never justifies weakening the journey.

Only after both tracks are complete, merge them in a page-level binding matrix. Every render intent binds to
journey steps, business obligations and contract-backed regions; every region cites the render intent it
serves. Any unbound intent, step, capability or region stops the run. Draw anatomy only from this matrix.

### 3. Pages stage — complete anatomy before states

Emit schema 7 `stage: pages`. Default `generate` creates one complete mature long page or flow in one representative populated state per page, at desktop and narrow viewports. Include full chrome, meaningful content, intentional hierarchy and density, every major region and complete block anatomy. Create the complete future state inventory now, but do not render those states yet.

The page contract binds the synthesis, routes, regions, representative states, hierarchy, density, responsive behavior, visual precedent, state inventory and representative full-viewport renders. `renderContract` and `executionPrompt` are forbidden.

Validate the artifact and schema 2 maturity review with `reviewStage: pages`. Refuse wireframes, sparse scaffolds, generic admin templates, unjustified dead space, unanchored controls, weak type rank and unfinished anatomy.

Publish a `pages` review and disclose `OK #1: PAGE ANATOMY`, candidate, canonical page-contract hash and routes. This approval is cache-only: it freezes page anatomy and opens state expansion; it never authorizes source writes. Three or four page alternatives require an explicit brainstorm request after the baseline is reviewed.

### 4. States stage — expand within approved pages

After `OK #1`, emit schema 7 `stage: states`, `mode: expand-states` and the approved page hash. Preserve the canonical page contract exactly. Expand every declared loading, empty, ready, error, permission, disabled, unavailable, success and overlay condition in the contract and executable in-memory behavior. Add transitions and source-owned data mappings. Classify each condition at its real owner: a page state exists only when region arrangement, hierarchy or active page-level composition changes; a condition confined to one subtree remains a block state even when evidence captures the complete page around it. Select no more than five complete-page render targets across the flow, each binding any page state plus the seeded block states visible in that capture, and render every target at each reference viewport. The exact render contract keeps the complete implementation inventory while its renders are this bounded evidence sample; then create the canonical execution prompt.

Before composing a complete render region, decompose it into closed child targets. Record one `grammarScopes` row per target with observable facts and exact slot/outcome/component decisions from the routed grammar. The region composes those owners and may not substitute a generic card for a resolved list, accordion, form or body surface. Run `@validate-layout-grammar` before source approval.

Before `OK #2`, print a source-owner matrix for every stateful region: state owner, exact drawing `ComponentBase`, optional connected `Component`, compositor kind plus exact `PageBase`/`LayoutBase`/`OverlayBase`, connected outer entry, and which child the parent renders. A block state requires a distinct child drawing owner. Nesting its state or data under Page, Layout or Overlay props while the outer surface still owns rendering is not extraction. Add nested Block chains only for independently stateful subtrees, never as dummy layers. Include every exact child and outer-surface file in the source boundary.

For every selected render target, also print a seed-owner row before `OK #2`: exact development/test identity, required page and block states, product-native seed owner, exact seed files or existing command, idempotency key, local dependencies and cleanup/safe-repeat behavior. New seed files belong to the approved source boundary. Cache fixtures cannot satisfy this contract.

Validate the artifact, layout grammar and schema 2 maturity review with `reviewStage: states`. A state that cannot fit approved page anatomy invalidates page approval. State-only feedback preserves page approval.

Publish a `states` review and disclose `OK #2: STATES + SOURCE BOUNDARY`, unchanged page hash, render contract and exact files. Only this approval authorizes source writes.

### 5. Code the approved source

After `OK #2`, take the target baseline and implement the canonical prompt without reinterpretation. A block-owned condition is rendered by its real `ComponentBase`/connected `Component`; `PageBase`, `LayoutBase` or `OverlayBase` composes that child and may not proxy its state or request data. Run canonical lint/tests for the complete state and transition contract.

### 6. Seed the real local product

Before browser proof, materialize every selected render target through the approved product-native seed owner. Prefer an existing idempotent bootstrap seeder or explicit development/test seed command; add seed source only when its exact files were approved. Seed the smallest deterministic graph needed by the real connected page, scope it to the declared test identity, mark it as development/test data and make reruns converge without duplicates.

This phase may start declared local dependencies and the real frontend/backend. It may not require a VPS, mutate production data, call an undeclared external provider or replace backend-owned truth with client mocks, component props, static HTML or cache fixtures. Prove the result through the product's own read path and record command, identity, stable identifiers and observed rows/states. A missing or failed seed stops visual proof; repair inside the approved boundary or return to `OK #2` for new files.

### 7. Prove real-product parity

Run browser proof for every selected render target, never more than five complete-page targets. Final proof requires real connected-product captures with the same page state, seeded block states and viewport, plus seed evidence, `parity: passed`, `mismatches: []` and terminal delivery. Repair in-boundary defects without a third approval.

## Rules

1. One invocation owns synthesis, two approvals, implementation, deterministic local seeding and QA.
2. Journey/business defines what must exist; component/contract evidence constrains how it is built.
3. One complete result is default; alternatives require explicit brainstorming.
4. `OK #1` is cache-only; only `OK #2` authorizes exact source files.
5. Page drift returns to page approval; state-only rejection preserves it.
6. Review artifacts are disposable cache; source and executable proof are durable.
7. MASTER is selected once and execution may not reinterpret the approved preview.
8. Ordered multi-stage progress uses connected stepper anatomy.
9. Cache fixtures never replace product-native seed data for final proof.
10. Every state-stage render child resolves through one grammar scope; its exact component owner is execution authority.

## Stops

- Missing route, scope, business authority, grammar/profile, contract, source baseline or flow endpoint.
- A journey step without page ownership or component capability.
- Fabricated content, incomplete state inventory, immature page evidence or non-functional HTML.
- `OK #1` treated as source authority, or `OK #2` without exact files.
- Hidden page-contract drift or required work outside the approved boundary.
- Missing seed ownership, unseedable selected state, non-idempotent seed or final proof that exists only in cache/component mocks.

## OUTPUT

At page review, report journey/business/component synthesis, page URL, maturity verdict and cache-only `OK #1`. At state review, report state coverage, unchanged page hash, exact source files, seed-owner rows and `OK #2`. After code, report changed files, tests, seed command/identity/observed data and real-product parity.
