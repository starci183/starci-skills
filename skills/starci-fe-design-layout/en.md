---
title: starci-fe-design-layout · English
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/en.md` | en | separate durable revisions from disposable drafts |
| `@business` | `contexts/business/en.md` | en | bind the page to current product truth |
| `@grammar` | `grammars` | module | load explicitly routed product-family facts, outcomes and owners |
| `@principles` | `compilers/principles` | module | review selected visual decisions after creativity |
| `@directions` | `brainstorms/directions/en.md` | en | evidence-select the visual direction embedded in the layout |
| `@layouts` | `brainstorms/layouts/en.md` | en | layout regions, axes, ownership and contract verdicts |
| `@design-review` | `publication/design-review-preview/en.md` | en | authored HTML review and immutable bundle contract |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reasons without exposing classes |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | emit deterministic selected grammar decisions and compact context |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove the routed grammar package before candidate work |
| `@verify-design-grammar` | `scripts/verify-design-grammar.mjs` | script | refuse accepted theme or receipt drift before publication |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind choices to the current frontend vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash design artifacts |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | verify current heads and accepted revisions |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish the cache review and accepted preview bundle |

## NESTED SKILLS

None.

## Run

This capability designs or revises one stable composed page set under one `layoutId`. A screenshot means the
whole visible page: every nested layout, the routed page, current state, visible modal/drawer/panel/floating
action, geometry, divider and scroll owner. A described flow means every explicit page or step in that flow. It
consumes one owner choice, completes deterministic states and publishes one immutable accepted revision. It
writes design records and review HTML, never frontend source.

Before candidate work, always present one scope checkpoint with a recommendation and ask the owner to confirm:

- `page`: this composed page plus every reachable modal, drawer, popover, menu, responsive form and state it owns;
- `flow`: every route/page/step from a confirmed start through a confirmed end/result, with shared layouts reused.

A screenshot does not authorize following a route-changing action. Journey language recommends `flow`, but the
agent still confirms its start and end. This is the layout round's scope decision, not a second direction gate.

**Authority.**

JSON and HTML answer different questions:

- `design.json` owns identity, business/contract ownership, grammar facts/decisions/receipt, regions, accepted
  artifact, state IDs and viewport obligations.
- `preview.html` owns composition, hierarchy, surfaces, responsive behavior and every rendered state.

Unaccepted candidates are drafts and live only below `.worktrees/<project>/cache`. Acceptance writes exactly:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

The design record carries `schemaVersion`, `kind: "layout"`, `layoutId`, the accepted artifact, state viewport
manifest and `previewSha256`. `revisionHash` binds canonical design metadata plus the exact preview digest. The
registry records that revision and points the stable layout head to it. Legacy object stores remain readable for
history, but cannot be the authority for a new acceptance or execution.

The visual direction has no independent approval. The evidence-backed recommendation is embedded in all layout
candidates, so the owner's one layout choice accepts both direction and composition.

## Process

**1. Establish evidence and scope.**

Read `@skill-shape`, resolve the caller-supplied `layoutId`, verify the `fe` route, registry ownership and clean
state, current business feature/surface and current visual vocabulary. First write a pattern sheet from the real
route tree: ordered root/app/feature layouts, routed pages, overlays and regions. Mark every node `existing`,
`proposed` or `new`. An `existing` node cites its source and source hash and is reused unchanged in every choice.
`Touching` names only the project registry and disposable cache. Then run the mandatory scope checkpoint. A
`page` stops at route-changing controls; a `flow` enumerates its confirmed start, intermediate pages and end.
When current or legacy source is the parity target, inventory every visible direct owner before candidate work:
path navigation, title/subtitle, identity/persona/media, surface primitive, choice-control sizing, actions,
overlays and responsive/scroll owner. Bind each retained item to its source path and hash. A candidate that drops
one is invalid unless owner feedback explicitly removes it; a polished screenshot is not parity proof.

**2. Author the choices.**

Validate the explicit grammar/profile pair from the route. Read `@directions` and `@layouts`, classify only
evidenced situations into closed facts, and run `@resolve-grammar`. Its outcomes and owners are binding semantic
constraints; missing facts or `new-required` owners return the decision. If an owner carries `visualContract`,
copy its axes, role tokens and exact `lockedTokens` into every direction; theme is not a candidate axis.
Evidence-select one recommended direction, resolve every region against the
contract by business reason, and author complete standalone HTML/CSS page-set candidates over the same
business-backed content and viewport set. Author three or four materially distinct choices, rank them against
business fit, precedent, hierarchy, reuse, accessibility and boundary ownership, then select the strongest.

Candidates differ materially in composition, navigation ownership, secondary-region treatment or density.
Colour-only, radius-only and spacing-only variants are duplicates. If the required choice count cannot be met
with materially distinct structures, refuse the draft instead of padding it.

JSON remains class-free. Every region receives `reuse`, measured `generalize`, or `new` with the need it answers.
Unresolved route, mounting or ownership choices are returned to the owner rather than invented.

**3. Review the complete page set per candidate.**

Render each candidate at desktop and at least one narrow viewport. The product canvas contains only authored
product UI with recognizable business content. A generic template, rough child, dashed anatomy card,
placeholder skeleton, region/schema/debug label, hash or evidence panel inside the canvas invalidates the review.
Documentation controls and evidence stay outside the iframe/product canvas.

**4. Publish the model selection.**

Show all choices, their ranking and one model-selected recommendation. The owner may override but does not
operate an A/B/C/D gate. Open `### NEED APPROVALS` only when product truth or write authority cannot be resolved.
Feedback opens a new draft round. It never mutates an accepted revision.

**5. Complete states and publish.**

After `OK`, render every deterministic state owed by the selected layout. Responsive and expanded/collapsed
states are included only when the layout can reach them. This work is implied by the accepted choice and does not
create a second approval checkpoint.

If a state cannot be derived without choosing a new route, owner, action or outcome, stop and open a new product
decision round. Do not disguise a product choice as state completion.

Validate the base and every state viewport, run `@verify-design-grammar` with the selected `preview.html`, calculate `previewSha256` and `revisionHash`, write the two immutable
files, register the revision and advance the stable layout head. Rebuild the review graph and run the registry
check. Losing candidates stay in cache and may be discarded.

## Visual quality

Every candidate and accepted state must prove:

1. Desktop and mobile navigation are mutually exclusive at their breakpoints.
2. Heading, primary action and supporting content have deliberate hierarchy.
3. Reading content has an intentional, readable measure.
4. Each visible boundary or divider belongs to the region separating the groups; no divider is required when no
   semantic boundary exists.
5. Each scrolling axis has exactly one declared owner; nested scrolling requires an evidenced independent
   viewport.
6. Every reachable layout state in `design.json` has matching authored HTML at the declared viewport.

`ScrollBranch`, `SurfaceListCard` and a divider are examples of possible contract resolutions. They are not
universal requirements and must not be introduced when the accepted situation does not call for them.

## Stops

- Missing/stale route, grammar/profile or receipt, business truth, vocabulary or registry ownership stops the run with exact evidence.
- Missing stable identity, duplicate candidate axes or fabricated product content refuses the draft.
- Missing candidate HTML, selected-state HTML or viewport coverage blocks approval/publication.
- A deterministic state that actually needs a product decision returns that decision; it never triggers a
  duplicate approval for already-decided work.
- Proposed data or legacy compatibility objects cannot replace a current head outside acceptance.

Every candidate is a self-contained functional HTML/CSS/JS page, not a static render. Before drawing, inventory
viewport, overlay, disclosure, async, data, permission and interaction conditions. Render desktop/mobile, modal,
drawer, menu/popover, expanded/collapsed, loading, empty, partial, error, success, locked and disabled whenever
business/source evidence makes them reachable; explicitly record irrelevant families as `not-applicable` with
evidence. Product controls—not review chrome—must execute deterministic in-memory transitions; network and
backend mutation are forbidden. Actual resize must drive responsive behavior.

Each page/state also carries a business-content matrix and renders production-like representative density: real
entity kinds, meaningful values, counts, statuses, metadata, actions and consequences. Lorem, placeholder copy,
generic cards, toy rows, repeated filler, title-only shells and visibly partial owned surfaces are blocking
defects. Missing condition coverage, executable transitions or business fidelity prevents selection/publication.

## OUTPUT

Before approval, report `layoutId`, scope (`page` or `flow`), the adaptive choice count, recommendation and review URL in concise prose.
Use one approval checkpoint. After `OK`, report accepted `revisionHash`, grammar receipt, persisted state/viewports and regions
still requiring block design. No status tables.
