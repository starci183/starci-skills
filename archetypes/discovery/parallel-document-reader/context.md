# Parallel document reader

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `parallel-document-reader` |
| Family | Discovery |
| Dominant task | Read and compare two stably aligned documents without editing or resolving either document. |
| Search aliases | `parallel reader, bilingual reader, aligned editions, side by side documents` |
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
| `AR-PDR-01` | Read and compare two stably aligned documents without editing or resolving either document. | Candidate when evidenced. |
| `AR-PDR-02` | Every region in `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position` is required and has a distinct owner. | Required for selection. |
| `AR-PDR-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-PDR-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-PDR-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-PDR-90` | Editable reconciliation requires a diff workbench. | Reject. |
| `AR-PDR-91` | A single document belongs to a manuscript reader. | Reject. |
| `AR-PDR-92` | Localization authoring is not read-only comparison. | Reject. |

### Selection rule

Select `parallel-document-reader` only when AR-PDR-01, AR-PDR-02, AR-PDR-03 are evidenced and none of AR-PDR-90, AR-PDR-91, AR-PDR-92 applies. Apply the responsive contract when AR-PDR-04 occurs. Return `needs-evidence` when AR-PDR-05 cannot be proven.

## Region graph

```text
parallel-reader
├─ document-pair-context
├─ alignment-navigator
├─ source-manuscript
├─ counterpart-manuscript
├─ alignment-notes-and-markers
└─ shared-reading-position
```

Canonical relationship: `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `parallel-reader` | Owns read-only comparison of two stably aligned documents; establishes pair version, aligned segment ID, active pane, zoom, notes, and reading position for every child without absorbing child responsibilities. |
| `document-pair-context` | owns pair identity, versions, and read-only purpose; consumes pair version, aligned segment ID, active pane, zoom, notes, and reading position from `parallel-reader` and publishes the same identity to `alignment-navigator`. |
| `alignment-navigator` | owns movement between stable alignment anchors; consumes pair version, aligned segment ID, active pane, zoom, notes, and reading position from `document-pair-context` and publishes the same identity to `source-manuscript`. |
| `source-manuscript` | owns source text and publishes the active aligned segment; consumes pair version, aligned segment ID, active pane, zoom, notes, and reading position from `alignment-navigator` and publishes the same identity to `counterpart-manuscript`. |
| `counterpart-manuscript` | owns counterpart text and consumes the same aligned segment; consumes pair version, aligned segment ID, active pane, zoom, notes, and reading position from `source-manuscript` and publishes the same identity to `alignment-notes-and-markers`. |
| `alignment-notes-and-markers` | owns unmatched, one-to-many, note, and bookmark markers; consumes pair version, aligned segment ID, active pane, zoom, notes, and reading position from `counterpart-manuscript` and publishes the same identity to `shared-reading-position`. |
| `shared-reading-position` | owns synchronization mode and exact return position across views; consumes pair version, aligned segment ID, active pane, zoom, notes, and reading position from `alignment-notes-and-markers` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep both manuscripts side by side with deterministic synchronized anchors and a clearly shared segment identity.
- **Navigation replacement:** No replacement; manuscripts remain side by side only while aligned linkage stays deterministic.
- **Sticky boundary:** Pair context may persist only with reserved space; neither manuscript overlays the other.
- **Overflow owner:** Each manuscript may own bounded vertical scroll only when anchor synchronization is deterministic.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Keep one manuscript primary and make the counterpart collapsible while the aligned-segment summary remains visible.
- **Navigation replacement:** Keep one manuscript primary and place the counterpart in a collapsible pane; show the current aligned segment summary.
- **Sticky boundary:** The counterpart pane returns focus to its view trigger.
- **Overflow owner:** Primary reading owns page flow; the temporary counterpart owns only its internal reading axis.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Toggle documents or interleave aligned segments while preserving exact anchor, zoom, notes, and reading position.
- **Navigation replacement:** Toggle source/counterpart or interleave aligned segments while preserving exact anchor, zoom, notes, and position.
- **Sticky boundary:** No manuscript surface is sticky at short height.
- **Overflow owner:** The active or interleaved reading sequence owns page flow.

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
| Initial/loading | `document-pair-context` | Load both manuscripts loading with partial failure isolated without replacing the last committed pair version, aligned segment ID, active pane, zoom, notes, and reading position. | Retain the last safe context in every band. |
| Ready | `alignment-notes-and-markers` | Expose active aligned segment, pane, zoom, and shared reading position as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `alignment-navigator` | Represent unmatched or one-to-many segment with explicit marker; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `alignment-notes-and-markers` | When one manuscript fails while the available manuscript remains readable, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `alignment-notes-and-markers` | Represent one manuscript is unavailable without implying an empty alignment; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `shared-reading-position` | While alignment jump, note load, or sync recovery, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `shared-reading-position` | After both views confirm the same aligned segment, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `alignment-notes-and-markers` | When version mismatch or paused synchronization, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `document-pair-context` | source↔counterpart focus and view toggles preserve exact anchor and return target. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `parallel-reader` | Resize preserves pair version, aligned segment ID, active pane, zoom, notes, and reading position, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Read and compare two stably aligned documents without editing or resolving either document.
- Every required region and the relationship `parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Editable reconciliation requires a diff workbench.
- A single document belongs to a manuscript reader.
- Localization authoring is not read-only comparison.
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
| [Apple Human Interface Guidelines — Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | pane relationships and collapse | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [TEI Guidelines — Linking, Segmentation, and Alignment](https://tei-c.org/release/doc/tei-p5-doc/en/html/SA.html) | stable segment alignment between parallel documents | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: parallel-document-reader
situationCodes: AR-PDR-01, AR-PDR-02, AR-PDR-03, AR-PDR-04, AR-PDR-05
searchAliases: parallel reader, bilingual reader, aligned editions, side by side documents
dominantTask: Read and compare two stably aligned documents without editing or resolving either document.
regions: parallel-reader, document-pair-context, alignment-navigator, source-manuscript, counterpart-manuscript, alignment-notes-and-markers, shared-reading-position
regionRelationships: parallel-reader → document-pair-context → alignment-navigator → source-manuscript ↔ counterpart-manuscript → alignment-notes-and-markers → shared-reading-position
responsive:
  wide: Keep both manuscripts side by side with deterministic synchronized anchors and a clearly shared segment identity.
  intermediate: Keep one manuscript primary and make the counterpart collapsible while the aligned-segment summary remains visible.
  compact: Toggle documents or interleave aligned segments while preserving exact anchor, zoom, notes, and reading position.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: parallel-reader → document-pair-context → alignment-navigator → source-manuscript → counterpart-manuscript → alignment-notes-and-markers → shared-reading-position
  navigationReplacement: Toggle source/counterpart or interleave aligned segments while preserving exact anchor, zoom, notes, and position.
  stickyBehavior: No manuscript surface is sticky at short height.
  overflowOwner: The active or interleaved reading sequence owns page flow.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
