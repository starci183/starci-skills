---
title: starci-fe-design-block · English
---

# starci-fe-design-block

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape/en.md` | en | shared approval and reporting boundary |
| `@workspaces` | `contexts/workspaces/en.md` | en | resolve and verify the frontend route |
| `@worktrees` | `contexts/worktrees/en.md` | en | separate durable revisions from disposable drafts |
| `@business` | `contexts/business/en.md` | en | resolve real data, actions and reachable states |
| `@grammar` | `grammars` | module | load routed product-family facts, block outcomes and owners |
| `@principles` | `compilers/principles` | module | audit selected anatomy after creativity |
| `@blocks` | `brainstorms/blocks/en.md` | en | block ownership, anatomy, state and contract law |
| `@design-review` | `publication/design-review-preview/en.md` | en | exact-parent HTML review and immutable bundle contract |
| `@inventory-visual-language` | `scripts/inventory-visual-language.mjs` | script | verify the vocabulary bound by the parent layout |
| `@resolve-grammar` | `scripts/resolve-fe-grammar.mjs` | script | recompute deterministic block grammar decisions and receipt |
| `@validate-grammar` | `scripts/validate-fe-grammar.mjs` | script | prove the routed grammar package before anatomy work |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | validate and hash design artifacts |
| `@design-registry-check` | `scripts/check-design-registry.mjs` | script | verify accepted parent and block heads |
| `@render-design-review` | `scripts/render-design-review.mjs` | script | publish cache review and accepted preview bundle |

## NESTED SKILLS

None.

## Run

This capability designs one declared block under one exact accepted composed page revision. It first resolves
the owning page inside that page set, then presents three or four materially distinct authored HTML choices in
the full parent page, ranks them and selects the strongest. It completes every deterministic
block state, and publishes one immutable accepted revision. It never writes frontend source.

**Authority.**

- `design.json` owns `(layoutId, blockId)`, parent `layoutHash`, grammar facts/decisions/receipt, data ownership,
  contract verdicts, anatomy, reachable state IDs and viewport obligations.
- `preview.html` owns block composition and every rendered state inside the exact accepted parent page.

Draft candidates exist only below `.worktrees/<project>/cache`. Acceptance writes exactly:

```text
registries/revisions/<revisionHash>/design.json
registries/revisions/<revisionHash>/preview.html
```

The design record carries `schemaVersion`, `kind: "block"`, `layoutId`, `blockId`, parent `layoutHash`, the
accepted artifact, state viewport manifest and `previewSha256`. `revisionHash` binds canonical design metadata
plus the preview digest. The registry records the revision and points the scoped block head to it. Legacy objects
are read-only compatibility.

## Process

**1. Bind to the accepted parent.**

Read `@skill-shape`. Verify the `fe` route, clean registry and current layout revision. The caller-supplied
`blockId` must be an exact declared region owned by exactly one composed page, and the block inherits the parent direction and geometry. A proposed
layout, undeclared region, stale parent hash or vocabulary mismatch stops before design.

**2. Resolve anatomy and states.**

Read only the business surface and flows that touch the region. Enumerate every reachable state before drawing
the candidates. `optional` describes presence; it cannot tell pending, empty and failed apart. Unknown ownership,
actions or outcomes are product decisions and are returned to the owner.

Validate the explicit grammar/profile pair and require the accepted parent's grammar receipt. Read `@blocks`,
classify evidenced block situations into closed facts, run `@resolve-grammar`, resolve every part by business reason,
and keep JSON class-free. Existing vocabulary must support
each cited leaf/composite, or the artifact records a measured generalization/new contract need.

**3. Author the choices in the full parent page.**

Author three or four complete standalone HTML/CSS block candidates using the exact accepted parent
`preview.html`, exact region bounds, same representative data and same viewports. Candidates differ in meaningful
anatomy or composition, not decoration alone. Rank them against business fit, precedent, hierarchy, reuse,
accessibility and boundary ownership, then select the strongest.

Review the entire parent page at desktop and one narrow viewport. Every nested layout, sibling region and
visible overlay outside the block remains identical to the accepted parent. The canvas contains authored product UI only:
no generated template, rough child, part card, dashed schema/debug label, hash or evidence chrome.

**4. Publish the model selection.**

Publish the ranking and model-selected block candidate. The owner may override but does not operate an A/B/C/D
gate. Open `### NEED APPROVALS` only when product truth cannot be resolved. Feedback opens a new draft round.

**5. Complete states and publish.**

Render all reachable states declared for the selected block. Deterministic state completion needs no
second approval. If completion reveals a new data owner, action, outcome or other product decision, return it in a
new round instead of guessing.

Validate every state/viewport, calculate `previewSha256` and `revisionHash`, write the two immutable files,
register the revision and advance the scoped block head. Rebuild the accepted parent review and run the registry
check. Losing candidates remain cache-only.

## Visual quality

Every candidate and accepted state must prove:

1. Desktop and mobile chrome remain mutually exclusive inside parent breakpoints.
2. Title, primary action, data and supporting detail form a clear hierarchy.
3. Text and repeated content keep an intentional readable measure.
4. Each divider or boundary belongs to the grouping it separates and is omitted when no boundary exists.
5. The region has exactly one scroll owner per axis unless an evidenced independent viewport requires nesting.
6. Every reachable state has matching authored HTML at its declared viewport and retains the selected visual
   language.

`ScrollBranch`, `SurfaceListCard` and dividers are situation-specific examples, never compulsory wrappers.

## Stops

- Missing accepted parent revision, grammar/profile/receipt, undeclared block or stale parent binding stops the run.
- Unknown data ownership, action, outcome or state returns the product decision.
- Missing candidate HTML, exact-parent embedding, selected-state HTML or viewport coverage blocks
  approval/publication.
- Missing contract or vocabulary support stops rather than inventing a component.
- Proposed or legacy compatibility objects cannot become current outside acceptance.

Every candidate is a functional HTML/CSS/JS block inside the exact accepted page. Inventory viewport, overlay,
disclosure, async, data, permission and interaction conditions; render every reachable modal, drawer,
menu/popover, expanded/collapsed, loading, empty, error, locked and disabled state. In-page native controls execute
deterministic transitions; review selectors, static renders and network behavior do not count.

Every state has a business-content matrix and production-like representative entities, facts, counts, statuses,
actions, consequences and density. Generic cards, toy rows, filler and partial owned surfaces are refused.

## OUTPUT

Before approval, report `layoutId`, `blockId`, parent `layoutHash`, the three or four choices, recommendation and
review URL. Use one approval checkpoint. After `OK`, report accepted `revisionHash` and proved states/viewports.
No status tables.
