---
name: starci-fe-design-block
description: Challenge and design one declared block inside its exact accepted composed page using GPT‑5.6 visual judgment, source precedent and StarCi truth/proof boundaries. Publishes one functional immutable accepted revision covering every evidenced UI condition; never writes frontend source.
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/context.md` | context | shared approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/context.md` | context | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/context.md` | context | separate durable revisions from disposable drafts |
| `@business` | `contexts/business/context.md` | context | resolve real data, actions and reachable states |
| `@principles` | `compilers/principles/context.md` | context | audit the model-selected anatomy after creativity |
| `@blocks` | `brainstorms/blocks/context.md` | context | block ownership, anatomy, state and contract law |
| `@design-review` | `publication/design-review-preview/context.md` | context | exact-parent HTML review and immutable bundle contract |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | verify the vocabulary bound by the parent layout |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash design artifacts |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | verify accepted parent and block heads |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish cache review and accepted preview bundle |

## NESTED SKILLS

None.

## Run

Read `@skill-shape` first. The caller supplies stable `layoutId` and `blockId`. `layoutId` resolves an accepted
composed page set; `blockId` must be one declared target region on exactly one page. The block inherits that
page's full nested composition, direction and geometry; it never accepts a second direction or parent hash.

JSON and HTML have separate authority:

- `design.json` owns `(layoutId, blockId)`, parent `layoutHash`, data ownership, contract verdicts, anatomy,
  per-state business-content matrix, UI-condition inventory, transitions, reachable state IDs and viewport obligations.
- `preview.html` owns the block's functional composition and every rendered state inside the exact accepted parent page.

Drafts live only below `.worktrees/<project>/cache`. Acceptance writes exactly one immutable bundle:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

`design.json` carries `schemaVersion`, `kind: "block"`, `layoutId`, `blockId`, `layoutHash`, the accepted
artifact, state viewport manifest and `previewSha256`. `revisionHash` binds canonical design metadata plus the
preview digest. The registry's revision map and scoped block head are authority; legacy objects are read-only
compatibility.

## Process

1. Resolve the context lock, verified `fe` route, clean registry worktree and current accepted layout revision.
   Resolve the owning page and refuse an undeclared `blockId`, stale parent binding, missing page placement or
   mismatched visual vocabulary.
2. Read only the business surface and flows touching this region. Enumerate every reachable condition before drawing:
   viewport, overlay, disclosure, async, data, permission and interaction states. Modal, drawer, popover/menu,
   loading, empty, partial, error, success, locked and disabled are included when evidence can reach them;
   irrelevant families are explicitly `not-applicable` with evidence. Build a business-content matrix naming the
   representative entities, fields, counts, statuses, actions, consequences and density owed by each state.
   Enumerate every reachable state before drawing
   candidates; contract `optional` never substitutes for source evidence about pending, empty or failed states.
3. Read `@blocks`, then challenge the region before drawing: identify its visual job, what the eye should read
   first, whether an existing ListBox/list surface/card/branch already solves grouping, and who owns its boundary
   and scroll. Resolve parts by business reason. Author 3–4 complete HTML/CSS blocks inside the exact accepted
   page state in parent `preview.html`, exact region bounds and representative data. Candidates are functional
   HTML/CSS/JS, not screenshots: their controls execute deterministic in-memory transitions. Each must change meaningful
   anatomy, grouping or interaction ownership; decoration alone is a duplicate. Rank them against business fit,
   precedent fit, hierarchy, reuse, accessibility and boundary ownership, then select the strongest. Every nested
   layout and sibling region remains the accepted `existing` rendering.
4. Review the candidate region in the whole parent page at desktop and one narrow viewport. The product canvas
   contains only authored product UI: no generated template, rough child, part card, dashed schema/debug label,
   hash or evidence chrome.
5. Audit the model-selected anatomy through `@principles` after creative comparison. Persist class-free
   `principleObligations` with target, module, canonical situation and business/visual reason. Missing or
   contradictory principle law returns the block decision instead of producing an ad-hoc approximation.
6. Publish the model-selected block candidate and its evidence. The skill invocation delegates this visual
   selection; the owner may override it, but does not operate a mandatory A/B/C/D gate. Open
   `### NEED APPROVALS` only when evidence cannot close a business/product decision. Feedback opens a new draft
   round and never edits accepted history.
7. Render all reachable states declared for the chosen block and prove every declared transition from an in-page
   control at desktop and narrow widths. The QA state selector does not count as product interaction. This deterministic completion needs no
   second approval. If completion reveals a new data owner, action, outcome or other product decision, stop and
   open one new approval round rather than guessing.
8. Validate all state/viewports, write the immutable two-file revision bundle, advance the scoped block head to
   `revisionHash`, rebuild the parent review and run the registry check. Losing candidates remain cache-only.

## Visual quality

Every candidate and selected state must prove:

- desktop and mobile chrome remain mutually exclusive inside the parent breakpoints;
- title, primary action, data and supporting detail form a clear hierarchy;
- every state is information-complete for the owned business job, with production-like representative density;
  the viewer can understand the entity, status, available action and consequence from the canvas alone;
- text and repeated content keep an intentional readable measure;
- each divider or boundary is owned by the grouping it separates, and is omitted when no boundary is needed;
- the region has exactly one scroll owner per axis unless an evidenced independent viewport requires nesting;
- every reachable state uses the same accepted composition language and has matching authored HTML.
- every condition inventory entry maps to rendered states, and modal/drawer/popover/async/data/permission states
  are neither omitted nor represented only by labels;
- every declared transition is keyboard-operable and runs without backend or network mutation;
- responsive behavior survives actual resize of the same composition rather than swapping to an unrelated copy.

`ScrollBranch`, `SurfaceListCard` and dividers are situation-specific examples, never compulsory wrappers.

## Stops

- Missing accepted parent revision, owning page, undeclared block identity or stale `layoutHash` → stop.
- Unknown data ownership, action, outcome or state → return the product decision, never infer it.
- Missing candidate HTML, parent embedding, selected-state HTML, condition coverage, executable transition or
  viewport coverage → do not approve or publish. A render-only block is invalid.
- Missing contract/vocabulary citation → stop rather than invent a component.
- Lorem ipsum, placeholder copy, generic cards, toy row counts, repeated filler or a partial business surface →
  refuse even when the HTML is functional.
- Proposed or legacy compatibility objects presented as current authority → stop.

## OUTPUT

In concise prose, give `layoutId`, `blockId`, parent `layoutHash`, 3–4 ranked candidates, the model-selected
recommendation and review URL. Ask nothing unless a genuine product decision remains.
Use one approval checkpoint. After `OK`, report the accepted `revisionHash` and proved states/viewports. No status
tables.
