---
name: starci-fe-design-layout
description: Design, stage-approve, implement, seed and browser-prove one production-mature complete long page or end-to-end frontend flow. Authenticated flows must prove the real product login UI by entering test credentials in Playwright before protected-page parity can pass. One direction is default; 3–4 require an explicit owner brainstorm request.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared staged approval and reporting boundary |
| `@orchestration` | `orchestration/context.md` | context | assign decision, HTML, source and proof phases safely across the active runtime |
| `@classify-fe-change` | `scripts/classify-frontend-change.mjs` | script | refuse ceremony larger than the measured frontend impact |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/context.md` | context | keep disposable review evidence in the current session |
| `@composition` | `brainstorms/composition/context.md` | context | lock Scope, Owner, Invariant and Proof |
| `@business` | `contexts/business/context.md` | context | bind journey and page decisions to current product truth |
| `@grammar` | `grammars/context.md` | context | load routed facts, outcomes and owners |
| `@principles` | `compilers/principles/context.md` | context | audit selected visual decisions |
| `@patterns-fe` | `compilers/patterns/fe/context.md` | context | choose source ownership before writing |
| `@lints-fe` | `gates/fe/lints/context.md` | context | prove implemented source |
| `@layouts` | `brainstorms/layouts/context.md` | context | validate journey/business/component synthesis and staged contracts |
| `@frontend-quality` | `brainstorms/frontend-quality/context.md` | context | run the integrated craft, UX, accessibility, engineering and detector review before HTML |
| `@design-review` | `publication/design-review-preview/context.md` | context | publish page and state reviews in cache |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reasons without exposing classes |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit selected grammar decisions and compact context |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove the routed grammar package |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse theme or receipt drift |
| `@validate-layout-grammar` | `scripts/validate-layout-grammar.mjs` | script | bind every render child target to its exact resolved semantic owner |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind design to current frontend vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | enforce schema 9 page/state, quality-review and capability-proof boundaries |
| `@validate-baseline` | `scripts/validate-design-baseline.mjs` | script | refuse wrong parent or missing full-page proof |
| `@validate-principles` | `scripts/validate-fe-principles.mjs` | script | refuse phantom principle concerns |
| `@maturity-schema` | `publication/design-review-preview/maturity.schema.json` | file | bind page-stage and state-stage maturity to captures |
| `@validate-maturity` | `scripts/validate-design-maturity.mjs` | script | refuse juvenile, generic or unfinished previews |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish the staged cache review |
| `@validate-visual-proof` | `scripts/validate-visual-proof.mjs` | script | enforce final same-viewport parity |
| `@business-boundary` | `scripts/business-write-boundary.mjs` | script | prove business authority before source writes |

## NESTED SKILLS

None. This skill owns design through implementation and QA in one invocation.

## IMPACT ROUTING

Run `@classify-fe-change` before creating a design session. Layout accepts `page`, `capability` and `cross-domain`.
Route `micro` to a plain exact edit and `component` to Block. For `capability` or `cross-domain`, dispatch a blind,
read-only reviewer distinct from the coordinator; source cannot start until concrete challenges are evidence-closed.

## PIPELINE

Topology: `dual-track` until page synthesis, then `linear` execution and proof. Resolve the shared context envelope
once. Give the top-down owner only normalized evidence plus routed business authority; give the bottom-up owner only
scope, routed source, contracts and current capability evidence. Neither sees the other's draft. A coordinator joins
only gate-passed outputs, owns every decision and shared artifact, and delegates only disjoint approved writes.

| Step | Track | Input | Transform | Required output | Gate |
|---|---|---|---|---|---|
| evidence | shared | request, routed authorities, current baseline | normalize facts, owner constraints, examples and unknowns | evidence pack plus immutable context envelope | every claim has provenance and scope |
| orchestration | coordination | immutable evidence envelope and measured runtime | apply the Layout phase map, dependency graph and one-writer registry | runtime adapter, task batches, coordinator reservations and sequential fallback | no approval; every task is bounded and every dependency is explicit |
| page-synthesis | join | evidence pack, business head, source baseline, components, contracts, grammar and MASTER | run isolated journey and capability subphases, print directions, join them, run integrated frontend-quality review, then author complete desktop/narrow anatomy | page map, capability obligations, binding matrix, direction receipt, quality review, schema 9 page contract and maturity evidence | both origins and all required quality lenses/detectors pass, nothing remains unbound, then `OK #1`; no source authority |
| states | execution | approved direction-quality-page hash, complete state truth | expand states, owners, transitions, seeds and boundary without direction, quality or page drift | schema 9 render contract, canonical prompt, source/seed matrices | manual `OK #2` or its bound auto receipt; exact files cover every required change |
| implementation | execution | approved canonical prompt | implement without reinterpretation, run source gates and seed real local data | implementation receipts, green gates and seed receipts | every approved obligation maps to source and product read-path evidence |
| parity | proof | approved previews and seeded product | classify authentication, execute any required login through product UI, compute PNG, normalized DOM, axe and Playwright-trace comparisons, then repair in-boundary defects | `visual-proof.json` schema 4 | authenticated proof enters test credentials in the browser with no session shortcut; per-reference thresholds and required interactions pass with zero known defect |

## Approval modes

`manual` is the default. If the invocation contains exact `mode=auto`, bind it to the immutable context-envelope
hash before page synthesis. After every normal gate passes, the coordinator selects the evidence-backed
recommendation and records bound auto receipts for `OK #1` and `OK #2`, then continues without pausing. It still
renders both reviews and exact boundaries. Missing defaults, red gates, credentials, destructive/external actions
or any scope/project/role/repository/write-boundary expansion stop for owner approval. Auto expires with this run.

## Run

Read `@skill-shape` and `@orchestration` first. Confirm exactly one scope: `page` for one complete composed route,
or `flow` for explicit start and terminal endpoints. A screenshot authorizes only what it shows. Create one ignored
session root at `.sessions/<project>/<session-id>/design` and validate the four-lock composition baseline.
Then build the internal orchestration plan from the frontend map; do not display its record unless `debug=true`. The coordinator authors
journey/UI decisions, the integrated quality verdict and approvals; workers may inventory lens/detector evidence,
project only an eligible frozen contract into cache HTML, implement disjoint approved paths, seed, test and capture
proof. Cache HTML may start only after the direction, quality review and page contract are frozen; source work may
start only after the source-authorizing manual or auto receipt.

The user-facing execution table exposes sections 1–3 below as one `page-synthesis` step. Page mapping, the two
isolated tracks, direction declaration, their join and desktop/narrow page rendering are internal subphases of
that one step; no intermediate `OK` may split them. Direction is always produced inside synthesis, never invoked
as a separate mode. The next approval is `OK #1` on the completed page anatomy, its printed directions and
integrated quality review.

### 1. Map pages before drawing

Before either design track begins, enumerate every page in scope. For each page record its id, route, actor,
entry, customer intent, decision made or observed there, successful outcome, failure consequence and the
closed set of render intents the page must visibly satisfy. A flow is incomplete until its start, every
decision page and terminal page appear in this map. Do not infer pages while drawing regions.

### 2. Resolve and print the journey and UI directions

Run the two tracks with isolated context owners when delegation is available. The top-down owner receives no
component inventory or proposed layout; the bottom-up owner receives no customer-journey regions or preferred
candidate. If delegation is unavailable, execute them sequentially with the same context firewall and keep their
artifacts separate until the join.

The top-down track produces the **journey direction**:

1. Read the routed business feature and its current head.
2. Name each customer actor, entry, goal and successful outcome.
3. Write the ordered journey steps as intent, decision, action and consequence.
4. Attach each step to the page on which the customer makes or sees that decision.
5. Enumerate business rules, allowed operations, data owners, entitlements and failure consequences. Never invent missing truth.
6. Print one concise flow-level journey direction naming the ordered experience, decisive waypoints and terminal
   outcome. It spans the complete page or flow; a multi-page scope does not create one independent direction per page.

The bottom-up contract-first track independently, without reading or adapting the proposed journey
regions:

1. Read the complete current composition and exact source owners.
2. Inventory reusable components, contracts, data mappings and current responsive behavior.
3. For every render intent a region serves, record one capability obligation: observable outcome, verdict
   `supported` or `missing`, exact source evidence, and exact required paths when missing.
4. Classify every proposed region as `reuse`, `generalize` or `new-required`, with exact source paths and a business reason.
   `reuse` is legal only when every obligation is supported; `generalize` or `new-required` must expose at least one
   missing obligation and the files needed to supply it.
5. Preserve existing source-bound nodes outside the approved deltas. A missing component is a `new-required` capability, never a reason to weaken the customer journey.

Only after both tracks are complete, merge them through an explicit page-level binding matrix. Every render
intent must bind to its journey steps, business obligations and one or more contract-backed regions; every
region must cite the render intent it serves. Preserve legacy/current composition evidence inside the
contract-first track, including nested visual owners and section boundaries, unless an allowed delta names
the exact departure. An unbound intent, journey step, capability or region stops the run. The merged matrix,
not either input track alone, is the only source from which page anatomy may be drawn.

From that joined matrix, print one **UI direction** naming page hierarchy, navigation/composition, responsive
behavior and emphasis. Then print one direction receipt containing the journey direction and UI direction as
separate fields before rendering their joined complete anatomy. The UI direction may not weaken a journey
obligation because current source lacks a component; that gap remains a `generalize` or `new-required` capability.

Before generating HTML, run `@frontend-quality` against the joined receipt, unchanged facts/content, detected
stack, current source and MASTER. External design skills, catalogues and guidelines may appear only as optional
digest-pinned advisory sources; they never add product truth or become binding. Resolve all ten lenses, name one
product-specific character move and close all six detector families. Revise or remove an ineligible draft rather
than present it. The coordinator owns the decision; workers may collect bounded evidence only.

The default direction count is exactly one receipt for the whole scope. When the owner explicitly requests
brainstorming before direction approval, synthesize three or four materially distinct complete receipts and
review each independently against identical facts before rendering their complete page/flow anatomies. Each
alternative contains both a journey direction and a UI direction plus its own quality review.
For a multi-page flow these remain three or four flow-level alternatives, never alternatives multiplied per page.

### 3. Pages stage — complete anatomy before states

Emit schema 9 with `stage: pages`. In default `generate` mode, author the complete long page or flow for the one
direction receipt. In explicit brainstorm mode, author three or four complete candidates and recommend one. Use
one representative populated state per page to judge the whole composition. Include full chrome, navigation,
content hierarchy, every major region, meaningful representative content, intentional density and desktop plus
narrow behavior. Layout owns the internal block anatomy necessary to make the page convincing; it does not leave
white placeholders for a later block pass.

The page contract must bind:

- the journey/business/component synthesis;
- page routes, representative states and region ownership;
- hierarchy, density, responsive decisions and visual precedent;
- the complete state inventory that will be expanded after approval;
- representative full-viewport renders at every reference viewport.

At this stage `renderContract` and `executionPrompt` are forbidden. The candidate binds its validated
`qualityReview`. Run `@validate-artifact`. Inspect the authored page captures and write schema 2 maturity evidence
with `reviewStage: pages` and `authorityId` equal to the page-contract id. Run `@validate-maturity`. Reject
wireframes, generic admin templates, enlarged primitive demos, sparse scaffolds, unjustified dead space,
unanchored controls, weak type rank, unfinished component anatomy or a quality receipt that is incomplete,
advisory-led or target-mismatched.

Render a review explicitly labeled `pages`. Print the journey direction and UI direction for every candidate.
Disclose `### NEED APPROVALS — OK #1: DIRECTION + QUALITY + PAGE ANATOMY`, the recommended candidate,
direction-quality-page hash,
routes and the fact that this approval is cache-only. With one direction, exact `OK #1` selects it. With explicit
brainstorming, `OK #1` also names `A`, `B`, `C` or `D`. Approval freezes the selected direction receipt,
quality review and exact page contract, then opens state expansion. It does not authorize any source write. “80%” is qualitative owner
feedback, not a numeric threshold.

### 4. States stage — expand inside the approved pages

After `OK #1`, emit schema 9 with `stage: states`, `mode: expand-states` and `approvedPageAt` equal to the SHA-256
of canonical selected `{directionReceipt, qualityReview, pageContract}`. Keep all three values byte-for-byte
equivalent under canonical hashing; state expansion cannot reopen or silently improve the approved quality review.

Expand every declared loading, empty, ready, error, permission, disabled, unavailable, success and overlay condition in the contract and executable in-memory behavior. Add all transitions and data mappings. Select no more than five representative page/state pairs across the whole flow for state review, prioritizing distinct high-risk condition and transition families. Every newly introduced route and every distinct `generalize`/`new-required` capability family must appear in at least one selected target. If that cannot fit the five-target ceiling, stop before `OK #2` and split the scope; never leave the riskiest new anatomy outside source parity proof. Render every selected state at every reference viewport with all of its regions. Then emit the exact `renderContract` and canonical `executionPrompt`; they keep complete page, region, state and transition implementation authority while `renders` records only that bounded visual-evidence sample. Preview values remain `representative-fixture`; runtime truth remains `source-owned`.

Before composing each complete render region, decompose it into closed child targets. Record one `grammarScopes` row per target with its observable facts and the exact slot/outcome/component decisions from `@resolve-grammar`. The region owner composes these semantic owners; it never substitutes a generic card for a resolved list, accordion, form or single-body surface. Run `@validate-layout-grammar` against the states artifact, routed grammar and routed profile before source approval.

Classify state at its real owner before inventory or rendering. A **page state** exists only when the page's region arrangement, hierarchy or active page-level composition changes, such as selecting a tab that replaces the main region. Loading, refusal, answered data, payment phase, launch connection and similar changes confined to one owned subtree are **block states** even when the complete page is captured around them. The evidence limit is no more than five complete-page render targets across the flow; each target names its page state when one exists and the seeded block states visible in that capture. Never promote a block state into a page state merely because proof renders the whole page.

In schema 9, every viewport row for one selected target carries the identical `visibleBlockStates` set, and every name resolves under a render-region data owner. The matching `renderContract.seedOwners.requiredStates` is exactly the selected page/state identity plus that visible block-state set; an omitted, invented or viewport-dependent state fails before `OK #2`.

Before `OK #2`, publish a source-owner matrix for every stateful region: state owner; drawing `ComponentBase` and exact `component.tsx`; optional connected `Component` and exact sibling `index.tsx`; compositor kind and exact `PageBase`, `LayoutBase` or `OverlayBase`; connected `Page`, `Layout` or `Overlay` entry; and whether the parent composes the connected or drawing child. A block state requires a distinct child drawing owner. Moving state or child request data under `PageProps`, `LayoutProps` or `OverlayProps` while the outer Base still resolves and renders it is not extraction and must fail the render contract. Layouts and overlays add nested Block chains only for independently stateful subtrees; do not invent a dummy layer for a terminal surface. The exact source boundary includes every real child and outer-surface file in the chain plus every `requiredPath` from a missing capability obligation. A boundary containing only a consumer while omitting the contract, branch, leaf or data owner required to express the approved anatomy is invalid.

For every selected render target, also publish one machine-validated `renderContract.seedOwners` row before
`OK #2`: the exact development/test identity; required page state and block states; product-native seed owner;
exact seed source files or an already-existing seed command; idempotency key; runtime dependencies; safe-repeat
behavior; and product read path. Any new seed file belongs to the exact source boundary. Cache HTML fixtures may
explain the design but may not satisfy this seed contract.

Before `OK #2`, classify the flow's authentication as `required` or `not-applicable`. A protected actor route makes
authentication required. Its product-owned login entry, username/password form, invalid-credential state,
successful session transition and protected landing route must already exist in the page map and selected proof
scope. If any is absent, page synthesis is incomplete: return to the pages stage rather than planning a direct
session mutation, cookie injection or proof-only login helper. Include every required login page, form owner,
session client, route transition and test in the exact source boundary.

Run `@validate-artifact`, `@validate-layout-grammar` and the schema 2 maturity review with `reviewStage: states`.
The embedded quality review must be byte-identical to the approved pages artifact. If a state cannot fit the
approved hierarchy, regions or responsive behavior, invalidate page approval and return to the pages stage. If
owner feedback changes only state expression, preserve the approved page contract and repeat only the states stage.

Render a review explicitly labeled `states`. Disclose `### NEED APPROVALS — OK #2: STATES + SOURCE BOUNDARY`, the
approved direction-quality-page hash, selected render contract, exact source paths and any product decision. `OK #2`
authorizes that candidate and those exact files once.

### 5. Code the approved source

After `OK #2`, take the target baseline and implement the canonical execution prompt immediately. Reuse contract owners before adding new ones. For block-owned conditions, reuse or create the real `ComponentBase`/connected `Component`; its `PageBase`, `LayoutBase` or `OverlayBase` composes that child while the connected outer entry owns only its own surface. Outer props may not proxy child state or child request data. Preview CSS is evidence, not source to paste. Do not reinterpret or simplify an approved obligation. If a required write falls outside the approved boundary, stop.

Run canonical lint/tests against the complete state and transition contract before depending on the implementation for seeded proof.

### 6. Seed the real local product

Materialize every selected render target through the approved product-native seed owner before browser proof. Prefer an existing idempotent bootstrap seeder or explicit development/test seed command; add seed source only when the approved boundary names it. Seed the smallest deterministic graph that makes the real connected page render: exact actor, route identities, parent records, child records and the page/block states selected for evidence. Mark the data as development/test data, scope it to the declared identity and make reruns converge without duplicates.

The seed phase may start declared local dependencies and the real frontend/backend, but it may not require a VPS, mutate production data, contact an undeclared external provider or substitute client mocks, static HTML, cache fixtures or component-only props for backend-owned truth. If an external runtime is itself the feature under proof, use its approved local fake/driver or stop for explicit authority. Prove the seed through the product's own read path and record the command, identity, stable identifiers and observed rows/states. A missing or failed seed contract stops visual proof; repair it inside the approved boundary or return to `OK #2` when new files are required.

When authentication is required, seed or resolve a dedicated development/test operator identity and make its
username/password available to browser automation only through process environment or an encrypted workspace
credential reference. Never place credential values in source, cache JSON, trace actions, screenshots, command-line
arguments or logs.

### 7. Prove real-product parity

Run browser proof against the real connected product for every selected render target. Five complete-page views is the default human-review budget, not a state-coverage invariant; add or split evidence only when a distinct uncovered risk requires it. Capture preview and source with identical page state, seeded block states and viewport.

For an authenticated flow, start Playwright signed out. Navigate to the product login entry, fill the username and
password controls with the declared test identity, submit the visible product form, wait for the protected route
and only then capture protected states. The authentication trace must record the standardized actions
`auth-open-login`, `auth-fill-username`, `auth-fill-password`, `auth-submit` and
`auth-reach-protected-route` with their real Playwright UI methods, without recording entered values. Direct
GraphQL/REST session creation, injected cookies or headers, preloaded `storageState`, `document.cookie` and any
proof-only authentication switch are invalid even when later screenshots look correct.

`visual-proof.json` schema 4 binds authentication applicability and its dedicated trace together with actual PNGs,
normalized DOM snapshots, axe reports and per-state Playwright traces. The validator computes the verdict using
per-reference thresholds. Repair in-boundary defects until green; no third approval is required.

## Rules

1. One invocation owns journey synthesis, design, two staged approvals, implementation, deterministic local seeding and QA.
2. Direction is a mandatory page-synthesis subphase. Layout prints journey direction and UI direction separately,
   then renders their joined complete anatomy.
3. The default is one flow-level direction receipt; three or four complete alternatives require an explicit owner
   brainstorm request before `OK #1` and are never multiplied per page.
4. Journey plus business defines the required experience; components plus contracts constrain its implementable anatomy.
5. Pages are approved before states. Manual `OK #1` or its bound auto receipt is cache-only; source writes require manual `OK #2` or its exact-boundary auto receipt.
6. Page-contract drift during state expansion returns to page approval.
7. State-only rejection preserves page approval when page anatomy is unchanged.
8. A page state changes page architecture; a local condition remains a block state even when its evidence is a full-page capture.
9. Candidates and previews live only in ignored session root; source and executable proof are durable.
10. MASTER is selected once; page files contain deviations only.
11. Multi-stage progress uses one connected semantic stepper with markers, connectors and completed/current/upcoming states.
12. Execution consumes the approved canonical prompt and may not reinterpret the preview.
13. Cache fixtures never replace product-native seed data for final real-product proof.
14. Every state-stage render child resolves through one grammar scope; the exact component owner is execution authority, not design commentary.
15. A capability `reuse` verdict is refused unless every bound render-intent obligation has observable source evidence. Ownership of data or state alone does not prove visual anatomy, responsive behavior or surface ownership.
16. Every new route and distinct non-reuse capability family is represented in final same-viewport proof; a missing `visual-proof.json` keeps the run incomplete regardless of source-gate status.
17. Journey obligations, FE capability, both printed directions, their join and page anatomy are one displayed `page-synthesis` step; their internal gates remain mandatory but never become separate owner approvals.
18. Layout owns first synthesis. Concrete owner feedback that rejects an emitted or implemented result as wrong
    Grammar/Principles leaves first-synthesis scope and enters the correction owner.
19. Every candidate passes the shared frontend-quality review before HTML. External UX/UI sources are optional,
    digest-pinned advisory evidence only; adopted decisions resolve to a StarCi owner.
20. Schema-9 state expansion preserves the approved quality review byte-for-byte; quality revision reopens pages.
21. An authenticated Layout run cannot finish until a signed-out Playwright browser enters the declared test
    username and password through the product form and reaches the protected route. API-created sessions and
    injected browser state never satisfy this gate.

## Stops

- Missing/stale route, business head, grammar/profile, contract vocabulary, source baseline or scope endpoint.
- A journey step without business authority, page ownership or an implementable component capability.
- Fabricated product content, incomplete state inventory or non-functional HTML.
- Generic or juvenile page character, weak hierarchy, unjustified dead space, unanchored chrome, unfinished
  component anatomy, failed maturity evidence, incomplete quality lenses/detectors or advisory evidence presented as authority.
- Ordered progress with three or more stages but no connected stepper owner.
- `OK #1` treated as write authority, or `OK #2` without exact source files.
- Page-contract drift hidden inside state work.
- Missing seed owner, unseedable selected state, non-idempotent seed or proof that exists only in cache/component mocks.
- A source, gate or visual defect that cannot be repaired inside the approved boundary.
- A protected route has no rendered product login entry, test credential owner or schema-4 browser authentication
  trace that fills both credential controls and reaches the protected route without a session shortcut.
- Concrete owner feedback identifies a wrong semantic owner, visual law or repeated skill decision in an already emitted result; preserve the exact rendered evidence — owner: `starci-fe-layout-refactor`.

## OUTPUT

At page review, print the journey direction and UI direction separately for every candidate, then report its
integrated quality verdict, joined complete page/flow URL, business/component synthesis, page maturity verdict and
cache-only `OK #1` boundary. At state review, report complete state coverage, unchanged direction-quality-page hash, state maturity verdict, exact
source files and seed-owner rows under `OK #2`. After implementation, report changed source files, tests, seed
command/identity/observed data, authentication applicability and—when required—the product login route plus
credential source class without values, followed by real-product parity proof.
