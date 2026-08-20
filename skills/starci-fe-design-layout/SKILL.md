---
name: starci-fe-design-layout
description: Challenge, design or revise one composed frontend page or flow using GPT‑5.6 visual judgment, source precedent and StarCi truth/proof boundaries. Renders a functional authored HTML prototype covering every evidenced UI condition and publishes one accepted immutable revision; never writes frontend source.
---

# starci-fe-design-layout

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/context.md` | context | separate durable revisions from disposable drafts |
| `@business` | `contexts/business/context.md` | context | bind the page to current product truth |
| `@principles` | `compilers/principles/context.md` | context | review model-selected visual decisions after creativity |
| `@directions` | `brainstorms/directions/context.md` | context | evidence-select the visual direction embedded in the layout |
| `@layouts` | `brainstorms/layouts/context.md` | context | layout regions, axes, ownership and contract verdicts |
| `@design-review` | `publication/design-review-preview/context.md` | context | authored HTML review and immutable bundle contract |
| `@contract-search` | `scripts/contract-search.mjs` | script | query contract reasons without exposing classes |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | bind choices to the current frontend vocabulary |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash design artifacts |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | verify current heads and accepted revisions |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish the cache review and accepted preview bundle |

## NESTED SKILLS

None.

## Run

Read `@skill-shape` first. The caller supplies one stable `layoutId`; that identity owns a composed page set,
not one framework layout component. The input is either one screenshot/current page or an explicitly requested
multi-page flow. This skill renders the complete visible experience and does not write frontend source.

A composed page is the ordered nested layout chain plus its routed page, current state and every visible modal,
drawer, popover, panel or floating action. Decomposition is internal evidence; the owner reviews full viewports.
Every composition node is classified `existing`, `proposed` or `new`. An `existing` node is bound to its source
path and content hash, is embedded unchanged in every candidate and is outside the design diff unless the request
explicitly targets it.

JSON and HTML have separate authority:

- `design.json` owns identity, business/contract ownership, regions, the per-state business-content matrix,
  UI-condition inventory, transition graph, state IDs and viewport obligations.
- `preview.html` owns composition, hierarchy, surfaces, responsive behavior and executable rendering of every
  declared condition/state.

Drafts live only below `.worktrees/<project>/cache`. Acceptance writes exactly one immutable bundle:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` carries `schemaVersion`, `kind: "layout"`, `layoutId`, the accepted page-set artifact, the state viewport
manifest and `previewSha256`. `revisionHash` binds canonical design metadata plus the preview digest. The
registry's revision map and layout head are lookup authority; legacy objects are read-only compatibility.

## Process

1. Resolve the context lock, verified `fe` route, clean registry worktree, current business surface and visual
   vocabulary. Before drawing, inventory the real route tree and emit a compact pattern sheet naming every nested
   layout, page, active overlay, region, breakpoint and scroll owner. `Touching` names only the project registry
   and disposable cache.
2. Convert the request into one page set. A screenshot produces exactly the visible page/state. A described flow
   produces every explicitly requested page in order, with shared layouts represented once and reused. Examples
   remain evidence unless the owner explicitly put them in scope.
3. Read `@directions` and `@layouts`, then run a short design challenge before drawing: identify the first visual
   focus, competing regions, navigation/content/evidence roles, reusable precedents, and the owner of width,
   divider, sticky and scroll behavior. Reject a composition that is only schema-complete. Evidence-select one
   direction without a separate approval.
4. Keep JSON free of classes. Schema 4 records each page's route, preview state, ordered composition nodes and
   regions. Bind every `existing` node to source path/hash and keep it identical across candidates. Resolve only
   target regions by business reason as `reuse`, measured `generalize`, or `new`; refuse unresolved ownership.
5. Before drawing, inventory every evidenced UI condition: wide/narrow viewport, overlay closed/open, drawer,
   modal, popover/menu, expanded/collapsed, ready/loading/empty/partial/error/success, permission/locked/disabled
   and any route or selection mode the page can reach. Record `not-applicable` with evidence instead of silently
   omitting a family. Author 3–4 complete functional HTML/CSS/JS page sets. Each must change hierarchy, navigation model, grouping or interaction
   ownership materially; decoration, spacing or wording alone is a duplicate. Rank them against business fit,
   precedent fit, visual hierarchy, reuse, accessibility and scroll/boundary ownership, then select the strongest.
   Review every candidate at desktop and one narrow viewport. Each candidate is the full composed viewport,
   never an isolated layout or page fragment. The product canvas contains only authored product
   UI: no generic template, rough child, dashed anatomy card, placeholder skeleton, schema/debug label, hash or
   evidence chrome. Build a business-content matrix for every page/state from the loaded surface and flows: real
   entity types, representative names/values, counts, statuses, metadata, actions, consequences and copy density.
   The reviewed scope must be as information-complete as the product truth, never reduced to a title, a few cards
   or toy rows. Navigation, tabs, disclosure, drawer/modal controls, forms and primary/retry actions execute
   in-memory transitions between declared states; the QA state selector is never the only way to reach a state.
6. After selecting the strongest candidate, review each unresolved visual decision through `@principles`.
   Creativity comes first; principles audit it rather than generating the candidates. Persist the resulting
   class-free `principleObligations` (`target`, principle module, canonical situation and reason) in `design.json`.
   Missing or conflicting principle law returns the design decision; do not approximate it with ad-hoc CSS.
7. Publish the model-selected candidate and its evidence. The skill invocation delegates this visual selection;
   the owner may override it, but does not have to choose A/B/C/D. Open `### NEED APPROVALS` only when evidence
   cannot close a business/product decision or the next action crosses an undisclosed write boundary. Feedback
   opens a new draft round and never edits accepted history.
8. Render every deterministic state owed by every page in the selected page set, including responsive,
   overlay, expanded/collapsed, async, data and permission conditions when the layout can actually reach them.
   Resize the same authored composition for responsive proof; a separately painted mobile copy is not responsive
   behavior. This is owned completion and has no
   second approval. If a state requires a new route, owner, action or other product decision, stop and open one
   new approval round instead of guessing.
9. Validate the selected base and all page/state viewports, write the immutable two-file revision bundle, advance the
   layout head to `revisionHash`, rebuild the review graph and run the registry check. Never persist losing
   candidates outside cache.

## Visual quality

Every candidate and selected state must prove:

- the viewport includes the entire nested layout chain, routed page and every visible overlay/floating surface;
- source-bound `existing` nodes are visually and structurally unchanged between candidates;
- desktop and mobile navigation are mutually exclusive at their breakpoints;
- heading, primary action and supporting content have an intentional hierarchy;
- each state renders business-faithful representative content at production-like density, including the facts,
  statuses, actions and consequences needed to understand the surface without reading evidence outside the canvas;
- reading content has an intentional, readable measure;
- each visible boundary or divider belongs to the region that separates the groups; absence is valid when no
  boundary is needed;
- each scrolling axis has exactly one declared owner; nested scrolling requires an evidenced independent
  viewport;
- all reachable layout states in `design.json` have matching authored HTML and declared viewports.
- every declared transition has a visible, keyboard-operable in-page control and reaches its target state without
  network or backend mutation;
- every condition in the inventory maps to at least one rendered state, and every reachable modal, drawer,
  popover, menu, loading, empty, error, locked and disabled surface is represented when evidence says it exists;
- the same preview responds to actual viewport resize; desktop/mobile screenshots are proof points, not separate
  unrelated compositions.

`ScrollBranch`, `SurfaceListCard` and a divider are examples of possible contract resolutions, not universal
requirements. Choose them only when the accepted situation calls for them.

## Stops

- Missing/stale route, business truth, vocabulary or registry ownership → stop with exact evidence.
- Missing stable `layoutId`, page-set decomposition, source evidence for an `existing` node, duplicate candidate
  axes or fabricated product content → refuse the draft.
- Lorem ipsum, placeholder labels, generic cards, toy row counts, repeated filler or a visibly partial business
  surface → refuse the draft even when schema and interactions pass.
- Fewer than 3 or more than 4 valid candidates, or candidates differing only by decoration → refuse the draft.
- Missing candidate HTML, required selected-state HTML, UI-condition coverage, executable transition or viewport
  coverage → do not approve or publish. A render-only preview is invalid.
- A post-choice state needs a new product decision → return that decision; do not request approval twice for
  deterministic work.
- A proposed or legacy compatibility object is presented as current authority → stop; only the current revision
  head may be replaced at acceptance.

## OUTPUT

In concise prose, give `layoutId`, page/flow scope, the pattern sheet, 3–4 ranked candidates, the model-selected
recommendation and review URL. Ask nothing unless a genuine product decision or write boundary remains.
Use one approval checkpoint. After `OK`, report the accepted `revisionHash`, persisted page/state viewports and
remaining block regions. No status tables.
