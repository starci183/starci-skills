# Immersive gallery lightbox

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `immersive-gallery-lightbox` |
| Family | Discovery |
| Dominant task | Browse visual assets and inspect one at a larger scale with essential metadata and actions. |
| Search aliases | `gallery, lightbox, asset viewer, visual collection` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- This archetype decides only the dominant task, required regions, region relationships, responsive transformation, and interaction parity.
- Grammar owns semantic and product owners; Principles own exact geometry and breakpoints; Direction owns visual character.
- Current source and research are evidence, not permission to copy layout or invent product fact.
- Region IDs, situation codes, and shared state remain stable across wide, intermediate, and compact.

## Recognition

### Situation codes

| Code | Situation | Verdict or obligation |
|---|---|---|
| `AR-IGL-01` | Browse visual assets and inspect one at a larger scale with essential metadata and actions. | Candidate when evidenced. |
| `AR-IGL-02` | Every region in `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions` is required and has a distinct owner. | Required for selection. |
| `AR-IGL-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-IGL-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-IGL-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-IGL-90` | Entity cards whose image is only a preview require a catalog. | Reject. |
| `AR-IGL-91` | Structured attribute comparison requires a comparison matrix. | Reject. |
| `AR-IGL-92` | A decorative hero is not an inspectable collection. | Reject. |

### Selection rule

Select `immersive-gallery-lightbox` only when AR-IGL-01, AR-IGL-02, AR-IGL-03 are evidenced and none of AR-IGL-90, AR-IGL-91, AR-IGL-92 applies. Apply the responsive contract when AR-IGL-04 occurs. Return `needs-evidence` when AR-IGL-05 cannot be proven.

## Region graph

```text
gallery
├─ collection-controls
├─ adaptive-visual-grid
├─ selected-stage
├─ next-previous-filmstrip
└─ metadata-actions
```

Canonical relationship: `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `gallery` | Owns visual-asset browsing and large-format inspection; establishes collection order, selected asset index, zoom, and focus-return target for every child without absorbing child responsibilities. |
| `collection-controls` | owns collection scope, ordering, and view controls; consumes collection order, selected asset index, zoom, and focus-return target from `gallery` and publishes the same identity to `adaptive-visual-grid`. |
| `adaptive-visual-grid` | owns visual browsing order and thumbnail selection; consumes collection order, selected asset index, zoom, and focus-return target from `collection-controls` and publishes the same identity to `selected-stage`. |
| `selected-stage` | owns large-format inspection of the selected asset; consumes collection order, selected asset index, zoom, and focus-return target from `adaptive-visual-grid` and publishes the same identity to `next-previous-filmstrip`. |
| `next-previous-filmstrip` | owns explicit previous/next movement and selected position; consumes collection order, selected asset index, zoom, and focus-return target from `selected-stage` and publishes the same identity to `metadata-actions`. |
| `metadata-actions` | owns essential metadata and asset actions without becoming entity detail; consumes collection order, selected asset index, zoom, and focus-return target from `next-previous-filmstrip` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Use a multi-track grid and a large selected stage with supporting metadata and keyboard-reachable previous and next controls.
- **Navigation replacement:** No replacement; collection grid and large stage may coexist when each remains usable.
- **Sticky boundary:** The viewer is modal only when opened as a lightbox; controls never obscure focused media actions.
- **Overflow owner:** Page flow owns the grid; the lightbox stage owns only bounded zoom or filmstrip overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Reduce tracks by intrinsic asset measure and move metadata below the stage or into disclosure.
- **Navigation replacement:** Reduce grid columns and move metadata below or into a named disclosure.
- **Sticky boundary:** The stage loses persistence before intrinsic asset size becomes unusable.
- **Overflow owner:** Page flow owns the grid; an open viewer owns its internal stage only.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Use a one- or two-track grid and a full-screen viewer whose close, previous, and next controls never depend on gesture.
- **Navigation replacement:** Use a one- or two-column grid and a full-screen viewer with explicit Close, Previous, and Next.
- **Sticky boundary:** Viewer controls reserve space and yield at short height.
- **Overflow owner:** The viewer owns one bounded media axis; the page never scrolls horizontally.

### Reflow

- DOM order and reading order follow the region graph; CSS does not reorder semantics.
- Resize does not reset query, selection, anchor, progress, path, or recovery state.
- Text zoom, long translation, missing media, and user content do not remove labels, relationships, or recovery routes.
- The page creates no horizontal scroll; any bounded exception belongs to the declared overflow owner.

### Interaction parity

- Every wide action, state, recovery route, and keyboard path exists at intermediate and compact.
- Temporary surfaces support Escape or cancel, contain modal focus, and return focus to the exact trigger.
- Dynamic status is announced without stealing focus; visual state never relies on color alone.
- Pointer, hover, gesture, and motion always have keyboard or static alternatives.

## State obligations

| State family | Region | Obligation | Responsive presentation |
|---|---|---|---|
| Initial/loading | `collection-controls` | Load thumbnail and full-asset loading independently without replacing the last committed collection order, selected asset index, zoom, and focus-return target. | Retain the last safe context in every band. |
| Ready | `next-previous-filmstrip` | Expose selected asset, index, zoom, and metadata as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `adaptive-visual-grid` | Represent missing metadata or unsupported asset with an equivalent description; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `next-previous-filmstrip` | When broken full asset while thumbnail and collection context remain, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `next-previous-filmstrip` | Represent unavailable asset action without hiding the asset; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `metadata-actions` | While full asset retry or metadata action, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `metadata-actions` | After asset action completes at the same selected index, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `next-previous-filmstrip` | When collection changes while a selected asset is open, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `collection-controls` | viewer close returns to the invoking thumbnail; next/previous never depend on gesture. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `gallery` | Resize preserves collection order, selected asset index, zoom, and focus-return target, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Browse visual assets and inspect one at a larger scale with essential metadata and actions.
- Every required region and the relationship `gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Entity cards whose image is only a preview require a catalog.
- Structured attribute comparison requires a comparison matrix.
- A decorative hero is not an inspectable collection.
- Reject when the difference from an existing archetype is only a product noun, card count, density, color, component, or state.

### Boundary verdict

Return `accept` when the selection rule and parity pass. Return `reject` for rejection evidence, `duplicate-or-variation` for a noun or presentation variation, and `needs-evidence` when one separating fact is unknown.

## Handoff

Grammar assigns semantic and product owners to each region. Principles resolve exact grid, measure, gap, size, alignment, overflow exceptions, and breakpoints after topology selection. Direction resolves visual character.

## Non-binding research evidence

### Evidence boundary

These official sources are advisory evidence for topology, interaction, and accessibility. They are not product truth, do not establish this synthesized archetype name as an official term, and do not license copied geometry, component trees, breakpoints, or visual treatment.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | adaptive layout and content priority | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | keyboard and widget interaction models | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: immersive-gallery-lightbox
situationCodes: AR-IGL-01, AR-IGL-02, AR-IGL-03, AR-IGL-04, AR-IGL-05
searchAliases: gallery, lightbox, asset viewer, visual collection
dominantTask: Browse visual assets and inspect one at a larger scale with essential metadata and actions.
regions: gallery, collection-controls, adaptive-visual-grid, selected-stage, next-previous-filmstrip, metadata-actions
regionRelationships: gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions
responsive:
  wide: Use a multi-track grid and a large selected stage with supporting metadata and keyboard-reachable previous and next controls.
  intermediate: Reduce tracks by intrinsic asset measure and move metadata below the stage or into disclosure.
  compact: Use a one- or two-track grid and a full-screen viewer whose close, previous, and next controls never depend on gesture.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: gallery → collection-controls → adaptive-visual-grid → selected-stage → next-previous-filmstrip → metadata-actions
  navigationReplacement: Use a one- or two-column grid and a full-screen viewer with explicit Close, Previous, and Next.
  stickyBehavior: Viewer controls reserve space and yield at short height.
  overflowOwner: The viewer owns one bounded media axis; the page never scrolls horizontally.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
