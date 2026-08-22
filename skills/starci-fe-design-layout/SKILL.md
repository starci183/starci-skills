---
name: starci-fe-design-layout
description: Design, stage-approve, implement, seed and visually prove one production-mature complete long page or end-to-end frontend flow. Starts top-down from customer journey and routed business truth, starts bottom-up from component/contract/source capability, synthesizes their intersection into complete pages, obtains page-anatomy approval, expands all states, obtains exact source-and-seed boundary approval, then codes, seeds the real local product and proves parity. One coherent baseline is default; 3–4 alternatives require an explicit brainstorm request.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared staged approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/context.md` | context | keep review evidence in session cache |
| `@composition` | `brainstorms/composition/context.md` | context | lock Scope, Owner, Invariant and Proof |
| `@business` | `contexts/business/context.md` | context | bind journey and page decisions to current product truth |
| `@grammar` | `grammars/context.md` | context | load routed facts, outcomes and owners |
| `@principles` | `compilers/principles/context.md` | context | audit selected visual decisions |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | choose source ownership before writing |
| `@lints-fe` | `gates/fe/lints/context.md` | context | prove implemented source |
| `@layouts` | `brainstorms/layouts/context.md` | context | validate journey/business/component synthesis and staged contracts |
| `@design-review` | `publication/design-review-preview/context.md` | context | publish page and state reviews in cache |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reasons without exposing classes |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit selected grammar decisions and compact context |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove the routed grammar package |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse theme or receipt drift |
| `@validate-layout-grammar` | `scripts/validate-layout-grammar.mjs` | script | bind every render child target to its exact resolved semantic owner |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind design to current frontend vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | enforce schema 7 page/state boundaries |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | refuse wrong parent or missing full-page proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | refuse phantom principle concerns |
| `@maturity-schema` | `publication/design-review-preview/maturity.schema.json` | file | bind page-stage and state-stage maturity to captures |
| `@validate-maturity` | `scripts/validate-design-maturity.mjs` | script | refuse juvenile, generic or unfinished previews |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish the staged cache review |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce final same-viewport parity |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority before source writes |

## NESTED SKILLS

None. This skill owns design through implementation and QA in one invocation.

## Run

Read `@skill-shape` first. Confirm exactly one scope: `page` for one complete composed route, or `flow` for explicit start and terminal endpoints. A screenshot authorizes only what it shows. Create one ignored session root at `.worktrees/<project>/cache/design/<session-id>` and validate the four-lock composition baseline.

### 1. Map pages before drawing

Before either design track begins, enumerate every page in scope. For each page record its id, route, actor,
entry, customer intent, decision made or observed there, successful outcome, failure consequence and the
closed set of render intents the page must visibly satisfy. A flow is incomplete until its start, every
decision page and terminal page appear in this map. Do not infer pages while drawing regions.

### 2. Resolve the experience from two independent directions

Build the top-down track first:

1. Read the routed business feature and its current head.
2. Name each customer actor, entry, goal and successful outcome.
3. Write the ordered journey steps as intent, decision, action and consequence.
4. Attach each step to the page on which the customer makes or sees that decision.
5. Enumerate business rules, allowed operations, data owners, entitlements and failure consequences. Never invent missing truth.

Build the bottom-up contract-first track independently, without reading or adapting the proposed journey
regions:

1. Read the complete current composition and exact source owners.
2. Inventory reusable components, contracts, data mappings and current responsive behavior.
3. Classify every proposed region as `reuse`, `generalize` or `new-required`, with exact source paths and a business reason.
4. Preserve existing source-bound nodes outside the approved deltas. A missing component is a `new-required` capability, never a reason to weaken the customer journey.

Only after both tracks are complete, merge them through an explicit page-level binding matrix. Every render
intent must bind to its journey steps, business obligations and one or more contract-backed regions; every
region must cite the render intent it serves. Preserve legacy/current composition evidence inside the
contract-first track, including nested visual owners and section boundaries, unless an allowed delta names
the exact departure. An unbound intent, journey step, capability or region stops the run. The merged matrix,
not either input track alone, is the only source from which page anatomy may be drawn.

### 3. Pages stage — complete anatomy before states

Emit schema 7 with `stage: pages`. In default `generate` mode, author exactly one coherent complete long page or complete flow. Use one representative populated state per page to judge the whole composition. Include full chrome, navigation, content hierarchy, every major region, meaningful representative content, intentional density and desktop plus narrow behavior. Layout owns the internal block anatomy necessary to make the page convincing; it does not leave white placeholders for a later block pass.

The page contract must bind:

- the journey/business/component synthesis;
- page routes, representative states and region ownership;
- hierarchy, density, responsive decisions and visual precedent;
- the complete state inventory that will be expanded after approval;
- representative full-viewport renders at every reference viewport.

At this stage `renderContract` and `executionPrompt` are forbidden. Run `@validate-artifact`. Inspect the authored page captures and write schema 2 maturity evidence with `reviewStage: pages` and `authorityId` equal to the page-contract id. Run `@validate-maturity`. Reject wireframes, generic admin templates, enlarged primitive demos, sparse scaffolds, unjustified dead space, unanchored controls, weak type rank or unfinished component anatomy.

Render a review explicitly labeled `pages`. Disclose `### NEED APPROVALS — OK #1: PAGE ANATOMY`, the recommended candidate, page-contract hash, routes and the fact that this approval is cache-only. `OK #1` freezes the exact page contract and opens state expansion. It does not authorize any source write.

Only after the owner has reviewed the one baseline and explicitly asks for brainstorming may `pages` stage generate 3–4 alternatives. They vary only the requested axis and remain complete pages. “80%” is qualitative owner feedback, not a numeric threshold.

### 4. States stage — expand inside the approved pages

After `OK #1`, emit schema 7 with `stage: states`, `mode: expand-states` and `approvedPageAt` equal to the canonical approved page-contract hash. Keep that page contract byte-for-byte equivalent under canonical hashing.

Expand every declared loading, empty, ready, error, permission, disabled, unavailable, success and overlay condition in the contract and executable in-memory behavior. Add all transitions and data mappings. Select no more than five representative page/state pairs across the whole flow for state review, prioritizing distinct high-risk condition and transition families. Render every selected state at every reference viewport with all of its regions. Then emit the exact `renderContract` and canonical `executionPrompt`; they keep complete page, region, state and transition implementation authority while `renders` records only that bounded visual-evidence sample. Preview values remain `representative-fixture`; runtime truth remains `source-owned`.

Before composing each complete render region, decompose it into closed child targets. Record one `grammarScopes` row per target with its observable facts and the exact slot/outcome/component decisions from `@resolve-grammar`. The region owner composes these semantic owners; it never substitutes a generic card for a resolved list, accordion, form or single-body surface. Run `@validate-layout-grammar` against the states artifact, routed grammar and routed profile before source approval.

Classify state at its real owner before inventory or rendering. A **page state** exists only when the page's region arrangement, hierarchy or active page-level composition changes, such as selecting a tab that replaces the main region. Loading, refusal, answered data, payment phase, launch connection and similar changes confined to one owned subtree are **block states** even when the complete page is captured around them. The evidence limit is no more than five complete-page render targets across the flow; each target names its page state when one exists and the seeded block states visible in that capture. Never promote a block state into a page state merely because proof renders the whole page.

Before `OK #2`, publish a source-owner matrix for every stateful region: state owner; drawing `ComponentBase` and exact `component.tsx`; optional connected `Component` and exact sibling `index.tsx`; compositor kind and exact `PageBase`, `LayoutBase` or `OverlayBase`; connected `Page`, `Layout` or `Overlay` entry; and whether the parent composes the connected or drawing child. A block state requires a distinct child drawing owner. Moving state or child request data under `PageProps`, `LayoutProps` or `OverlayProps` while the outer Base still resolves and renders it is not extraction and must fail the render contract. Layouts and overlays add nested Block chains only for independently stateful subtrees; do not invent a dummy layer for a terminal surface. The exact source boundary includes every real child and outer-surface file in the chain.

For every selected render target, also publish a seed-owner row before `OK #2`: the exact development/test identity; required page state and block states; product-native seed owner; exact seed source files or an already-existing seed command; idempotency key; runtime dependencies; and cleanup or safe-repeat behavior. Any new seed file belongs to the exact source boundary. Cache HTML fixtures may explain the design but may not satisfy this seed contract.

Run `@validate-artifact`, `@validate-layout-grammar` and the schema 2 maturity review with `reviewStage: states`. If a state cannot fit the approved hierarchy, regions or responsive behavior, invalidate page approval and return to the pages stage. If owner feedback changes only state expression, preserve the approved page contract and repeat only the states stage.

Render a review explicitly labeled `states`. Disclose `### NEED APPROVALS — OK #2: STATES + SOURCE BOUNDARY`, the approved page hash, selected render contract, exact source paths and any product decision. `OK #2` authorizes that candidate and those exact files once.

### 5. Code the approved source

After `OK #2`, take the target baseline and implement the canonical execution prompt immediately. Reuse contract owners before adding new ones. For block-owned conditions, reuse or create the real `ComponentBase`/connected `Component`; its `PageBase`, `LayoutBase` or `OverlayBase` composes that child while the connected outer entry owns only its own surface. Outer props may not proxy child state or child request data. Preview CSS is evidence, not source to paste. Do not reinterpret or simplify an approved obligation. If a required write falls outside the approved boundary, stop.

Run canonical lint/tests against the complete state and transition contract before depending on the implementation for seeded proof.

### 6. Seed the real local product

Materialize every selected render target through the approved product-native seed owner before browser proof. Prefer an existing idempotent bootstrap seeder or explicit development/test seed command; add seed source only when the approved boundary names it. Seed the smallest deterministic graph that makes the real connected page render: exact actor, route identities, parent records, child records and the page/block states selected for evidence. Mark the data as development/test data, scope it to the declared identity and make reruns converge without duplicates.

The seed phase may start declared local dependencies and the real frontend/backend, but it may not require a VPS, mutate production data, contact an undeclared external provider or substitute client mocks, static HTML, cache fixtures or component-only props for backend-owned truth. If an external runtime is itself the feature under proof, use its approved local fake/driver or stop for explicit authority. Prove the seed through the product's own read path and record the command, identity, stable identifiers and observed rows/states. A missing or failed seed contract stops visual proof; repair it inside the approved boundary or return to `OK #2` when new files are required.

### 7. Prove real-product parity

Run browser proof against the real connected product for every selected render target, never more than five complete-page targets. Capture preview and source with the identical page state, seeded block states and viewport. `visual-proof.json` must bind the candidate and render contract, seed proof, real capture paths, `parity: passed`, `mismatches: []` and terminal delivery state. Repair in-boundary defects until green; no third approval is required.

## Rules

1. One invocation owns journey synthesis, design, two staged approvals, implementation, deterministic local seeding and QA.
2. The default is one complete production-mature page/flow; alternatives require explicit brainstorming.
3. Journey plus business defines the required experience; components plus contracts constrain its implementable anatomy.
4. Pages are approved before states. `OK #1` is cache-only; only `OK #2` authorizes source writes.
5. Page-contract drift during state expansion returns to page approval.
6. State-only rejection preserves page approval when page anatomy is unchanged.
7. A page state changes page architecture; a local condition remains a block state even when its evidence is a full-page capture.
7. Candidates and previews live only in ignored project cache; source and executable proof are durable.
8. MASTER is selected once; page files contain deviations only.
9. Multi-stage progress uses one connected semantic stepper with markers, connectors and completed/current/upcoming states.
10. Execution consumes the approved canonical prompt and may not reinterpret the preview.
11. Cache fixtures never replace product-native seed data for final real-product proof.
12. Every state-stage render child resolves through one grammar scope; the exact component owner is execution authority, not design commentary.

## Stops

- Missing/stale route, business head, grammar/profile, contract vocabulary, source baseline or scope endpoint.
- A journey step without business authority, page ownership or an implementable component capability.
- Fabricated product content, incomplete state inventory or non-functional HTML.
- Generic or juvenile page character, weak hierarchy, unjustified dead space, unanchored chrome, unfinished component anatomy or failed maturity evidence.
- Ordered progress with three or more stages but no connected stepper owner.
- `OK #1` treated as write authority, or `OK #2` without exact source files.
- Page-contract drift hidden inside state work.
- Missing seed owner, unseedable selected state, non-idempotent seed or proof that exists only in cache/component mocks.
- A source, gate or visual defect that cannot be repaired inside the approved boundary.

## OUTPUT

At page review, report the customer journey, business/component synthesis, complete page/flow URL, page maturity verdict and cache-only `OK #1` boundary. At state review, report complete state coverage, unchanged page hash, state maturity verdict, exact source files and seed-owner rows under `OK #2`. After implementation, report changed source files, tests, seed command/identity/observed data and real-product parity proof.
