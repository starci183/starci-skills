# Frontend design orchestration map

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@composition` | `brainstorms/composition/context.md` | context | bind Scope, Owner, Invariant and Proof before visual decisions |
| `@directions` | `brainstorms/directions/context.md` | context | preserve MASTER bypass and visual-direction limits |
| `@layouts` | `brainstorms/layouts/context.md` | context | bind page synthesis, states, source ownership and staged approvals |
| `@blocks` | `brainstorms/blocks/context.md` | context | bind block state-first anatomy and complete-parent proof |
| `@frontend-quality` | `brainstorms/frontend-quality/context.md` | context | bind integrated frontend review and advisory-source boundary |

## Record

This is the complete phase map for the three frontend design skills. “Coordinator” maps to Sol in Codex and Opus
in Claude; “worker” maps to Luna in Codex and Sonnet in Claude. The coordinator owns every semantic decision.
Workers materialize, measure or implement an already frozen decision.

The dependency spine is:

```text
request + routed truth
  -> four-lock composition baseline
  -> internal execution plan
  -> coordinator decision contract
  -> coordinator quality verdict + worker detector evidence
  -> worker cache HTML/captures
  -> coordinator approval gate
  -> complete state/source contract
  -> worker approved source/seed/test work
  -> coordinator integration and parity verdict
```

HTML before a frozen eligible decision contract and quality receipt is unauthorized design. Product code before the source-authorizing approval
is unauthorized implementation. An agent label never weakens either boundary.

## Skill bindings

| Skill | Exact phase map |
|---|---|
| `starci-fe-design-layout` | Layout map |
| `starci-fe-design-block` | Block map |
| `starci-fe-layout-refactor` | Refactor map |

## Approval execution mode

The three bound frontend skills default to `manual`. Exact `mode=auto` on the invocation binds
`phaseGates.approvalMode: auto` and `autoApprovalAt` to the immutable envelope. In the tables below, `OK #1` and
`OK #2` name checkpoint identities in both modes: manual presents and waits; auto selects only the coordinator's
evidence-backed recommendation and emits `AUTO:<autoApprovalAt>:OK #n:<boundaryAt>` after the same gate passes.
Workers still depend on the passed gate event. Auto never changes a decision, artifact, writer registry or proof
gate and stops on any undisclosed boundary, credential, destructive action or external commitment.

## Layout map

| Step | Coordinator work | Worker work | Artifact | Dependency and gate |
|---|---|---|---|---|
| `evidence` | resolve route, business head, scope kind, page set and immutable envelope; accept or refuse evidence | independently inventory four-lock composition, route/current/legacy source, component/contract vocabulary, visual vocabulary and state/capability facts | `baseline.json`, evidence pack, page-intent facts and source digests | all facts have provenance; no UI decision yet |
| `orchestration` | classify impact, choose runtime adapter, partition tasks and reserve shared files | verify each assigned read/output/write boundary and challenge unsupported evidence | internal run record | one writer per path; every output has a consumer; unsafe or overhead-negative work becomes sequential |
| `page-synthesis` | author page map, journey direction, business obligations, merge bindings, UI direction, candidate anatomy and canonical schema-9 `pageContract`; own all ten lens decisions, character signature and eligibility; recommend the candidate | run isolated top-down/capability audits; collect bounded quality evidence and six detector-family results; only after coordinator freezes eligible JSON, generate complete desktop/narrow HTML, interactions and captures | direction receipt, quality review, synthesis matrix, pages artifact, preview HTML and maturity evidence | independent receipts pass before join; binding evidence outranks advisory evidence; HTML projects frozen eligible JSON; Sol/Opus presents `OK #1` |
| `states` | classify page versus block ownership, choose risk-covering complete-page targets, freeze transitions, SPLIT-6 ownership, seeds and exact source boundary | inventory reachable conditions and transitions, ownership and seed feasibility; generate state evidence only after targets freeze | states contract, source/seed boundary and selected review | five views is the default review budget, not a coverage cap; approved page unchanged; `OK #2` |
| `implementation` | assign disjoint approved path subsets, keep shared entrypoints/contracts or assign each to exactly one worker, review diffs and integrate | implement exact render contract, product-native idempotent seeds and relevant tests only in assigned approved files | per-task implementation and seed receipts plus integrated diff | starts only after `OK #2`; required outside path returns to approval |
| `parity` | reproduce computed results, direct bounded repairs and issue final verdict | run gates, seed identities, capture PNG/DOM/axe/Playwright evidence | computed visual, structural, accessibility and interaction proof | configured per-reference thresholds pass; zero known defect |

The two Layout origins remain independent until the coordinator join. Workers may inventory journey facts,
source capability, quality evidence and detector results, but only the coordinator authors the journey direction,
UI direction, binding matrix, adopted quality decisions and eligibility verdict.

## Block map

| Step | Coordinator work | Worker work | Artifact | Dependency and gate |
|---|---|---|---|---|
| `bind` | bind exactly one Layout-generated region, current parent, business reason and four locks; decide whether scope is still Block | measure parent digest, child tree, preserved nodes, states/conditions, contract vocabulary and current source ownership | `baseline.json`, block evidence and `parentAt` | complete current parent is authoritative; no direction yet |
| `orchestration` | choose adapter, isolate cache/source/proof tasks and reserve UI/approval/integration decisions | verify bounded assignments and writer paths | orchestration receipt | no page recomposition; no approval |
| `direction` | verify the specified decision or resolve direction only when open; freeze schema-3 anatomy | audit feasibility and generate complete-parent HTML/captures after freeze | schema-3 block anatomy and quality review | every reachable state and BLOCK-1…15 law covered; no approval yet |
| `state-boundary` | choose risk-covering complete-page views and freeze exact component/test boundary | verify transitions, ownership and target coverage in complete parent | state review and exact source/test boundary | parent/journey unchanged; one `OK #1` approves decision and source boundary |
| `implement` | assign one writer per approved path, review parent preservation and integrate | implement all approved block states/transitions and relevant tests in disjoint paths | integrated diff and tests | starts only after the one exact approval; whole-page drift stops |
| `parity` | decide parent fit and final parity | run gates/browser interactions and capture complete-page responsive proof | `visual-proof.json` and final state views | zero known mismatch; isolated block crops never substitute |

## Refactor map

| Step | Coordinator work | Worker work | Artifact | Dependency and gate |
|---|---|---|---|---|
| `bind-classify` | freeze product truth and rendered scope; reproduce feedback; classify the highest failed layer | independently audit four locks, source-owner chains, grammar/principle counterexamples, impact cone and pre-existing dirt; make no authority edit | correction envelope, failure verdict evidence and owner chain | every observation reproducible; Layout/Block-rendered scope only |
| `orchestration` | select adapter and partition authority audit, HTML, FE source and proof; reserve all `.claude` writes and decisions | verify tasks, dependencies and disjoint writer subsets | orchestration receipt | authority and product tasks remain ordered when one depends on the other |
| `direction` | author the correcting UI direction using only already-rendered facts/regions and frozen journey; own standalone refactor quality receipt and eligibility | collect bounded lens/detector evidence; after eligible direction freeze, generate complete-context desktop/narrow HTML/captures; report feasibility mismatch without redesigning | direction review, quality receipt and cache artifact | grammar, maturity and quality review pass; Sol/Opus presents `OK #1` |
| `authority-state-boundary` | choose state views, decide the smallest authority layer to evolve, freeze authority-to-write map and exact FE/proof batch | measure every affected authority consumer, source chain, state family and test path; render frozen states | authority map, impact cone, state review and exact batch | no business/backend/seed expansion; Sol/Opus presents `OK #2` |
| `evolve-refactor` | edit paired `.claude` authority and executable cases when required, compile runtime context, validate dependency graphs, then integrate product changes | after authority gates pass, implement assigned disjoint FE files and tests; never edit `.claude` or reinterpret direction | authority receipts, compiled context, bounded FE diff and green gates | authority precedes dependent source; sound authority is preserved |
| `parity` | reproduce mismatch closure and issue final verdict | execute existing seeds, run gates/browser behavior and capture ensured states | `visual-proof.json` and at most five final complete-page views | zero known mismatch and no unrendered consumer left in impact cone |

## Scheduling rules

1. Three workers is runtime capacity, not a quality optimum. Dispatch only independent ready nodes with positive expected coordination benefit.
2. Cache HTML generation begins only after candidate/direction/anatomy JSON and its target-matched quality receipt
   are coordinator-frozen and eligible.
3. Source coding begins only after `OK #2`; Refactor source that depends on evolved authority waits for authority proof.
4. Prefer one implementation worker for a tightly coupled page. Split by files only when contracts and entrypoints do not overlap.
5. Test and browser workers may run beside independent implementation tasks only when they consume a stable build; otherwise they wait.
6. The coordinator reviews every receipt before unlocking dependents and owns all re-dispatch decisions.
7. Workers may run external catalogues or deterministic detectors only as bounded evidence tasks. They never adopt
   a recommendation, change authority or turn an external source into binding input.
