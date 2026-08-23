# Manuscript reader with notes

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `manuscript-reader-notes` |
| Family | Discovery |
| Dominant task | Read continuous long-form content while using outline, anchored notes, and bookmarks without becoming an editor. |
| Search aliases | `manuscript reader, long form notes, annotated reader, outline bookmarks` |
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
| `AR-MRN-01` | Read continuous long-form content while using outline, anchored notes, and bookmarks without becoming an editor. | Candidate when evidenced. |
| `AR-MRN-02` | Every region in `reader → document-outline → readable-manuscript → anchored-annotations → reading-position-and-bookmarks` is required and has a distinct owner. | Required for selection. |
| `AR-MRN-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-MRN-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-MRN-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-MRN-90` | Authoring documents require editing ownership. | Reject. |
| `AR-MRN-91` | A short article with a simple TOC does not require this topology. | Reject. |
| `AR-MRN-92` | Paged slides require a presentation stage. | Reject. |

### Selection rule

Select `manuscript-reader-notes` only when AR-MRN-01, AR-MRN-02, AR-MRN-03 are evidenced and none of AR-MRN-90, AR-MRN-91, AR-MRN-92 applies. Apply the responsive contract when AR-MRN-04 occurs. Return `needs-evidence` when AR-MRN-05 cannot be proven.

## Region graph

```text
reader
├─ document-outline
├─ readable-manuscript
├─ anchored-annotations
└─ reading-position-and-bookmarks
```

Canonical relationship: `reader → document-outline → readable-manuscript → anchored-annotations → reading-position-and-bookmarks`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `reader` | Owns continuous long-form reading with outline, anchored notes, and bookmarks; establishes document version, active heading, text anchor, zoom, notes, and reading position for every child without absorbing child responsibilities. |
| `document-outline` | owns document navigation and active-heading orientation without owning reading scroll; consumes document version, active heading, text anchor, zoom, notes, and reading position from `reader` and publishes the same identity to `readable-manuscript`. |
| `readable-manuscript` | owns continuous manuscript reading and primary scroll; consumes document version, active heading, text anchor, zoom, notes, and reading position from `document-outline` and publishes the same identity to `anchored-annotations`. |
| `anchored-annotations` | owns notes attached to stable text anchors without becoming an editor; consumes document version, active heading, text anchor, zoom, notes, and reading position from `readable-manuscript` and publishes the same identity to `reading-position-and-bookmarks`. |
| `reading-position-and-bookmarks` | owns saved position, bookmarks, zoom, and return-to-anchor behavior; consumes document version, active heading, text anchor, zoom, notes, and reading position from `anchored-annotations` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep outline, readable manuscript, and anchored notes simultaneous without creating competing free scroll.
- **Navigation replacement:** No replacement; outline, readable manuscript, and anchored notes may coexist without competing free scroll.
- **Sticky boundary:** Outline or notes may persist only beside the manuscript and must not obscure focused text.
- **Overflow owner:** Manuscript owns primary page reading; supporting rails own no free page scroll.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Keep only one supporting rail persistent and move the other to a drawer.
- **Navigation replacement:** Keep only one supporting rail persistent and move the other into a drawer.
- **Sticky boundary:** Drawer returns focus to the exact manuscript anchor trigger.
- **Overflow owner:** Manuscript remains the reading owner; drawer owns only internal note or outline content.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Use one manuscript column; outline and notes open as named sheets and return to the exact text anchor.
- **Navigation replacement:** Use one manuscript column with named outline and notes sheets; close returns to the exact text anchor.
- **Sticky boundary:** No reading aid is sticky at short height.
- **Overflow owner:** Page flow owns manuscript reading; sheets own temporary internal overflow only.

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
| Initial/loading | `document-outline` | Load document and saved position loading without replacing the last committed document version, active heading, text anchor, zoom, notes, and reading position. | Retain the last safe context in every band. |
| Ready | `anchored-annotations` | Expose active heading, text anchor, notes, and bookmark state as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `readable-manuscript` | Represent no annotation at an anchor without interrupting reading; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `anchored-annotations` | When partial document or note-save failure with manuscript retained, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `anchored-annotations` | Represent unavailable annotation without implying no note exists; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `reading-position-and-bookmarks` | While note add/edit, bookmark save, or position restore, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `reading-position-and-bookmarks` | After note or bookmark saves at the same text anchor, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `anchored-annotations` | When revision leaves an annotation anchor unresolved, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `document-outline` | annotation↔text focus and sheet close return to the exact text anchor. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `reader` | Resize preserves document version, active heading, text anchor, zoom, notes, and reading position, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Read continuous long-form content while using outline, anchored notes, and bookmarks without becoming an editor.
- Every required region and the relationship `reader → document-outline → readable-manuscript → anchored-annotations → reading-position-and-bookmarks` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Authoring documents require editing ownership.
- A short article with a simple TOC does not require this topology.
- Paged slides require a presentation stage.
- Media playback requires a theater.
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
| [W3C — EPUB Accessibility 1.1](https://www.w3.org/TR/epub-a11y-11/) | accessible long-form reading structure and navigation | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: manuscript-reader-notes
situationCodes: AR-MRN-01, AR-MRN-02, AR-MRN-03, AR-MRN-04, AR-MRN-05
searchAliases: manuscript reader, long form notes, annotated reader, outline bookmarks
dominantTask: Read continuous long-form content while using outline, anchored notes, and bookmarks without becoming an editor.
regions: reader, document-outline, readable-manuscript, anchored-annotations, reading-position-and-bookmarks
regionRelationships: reader → document-outline → readable-manuscript → anchored-annotations → reading-position-and-bookmarks
responsive:
  wide: Keep outline, readable manuscript, and anchored notes simultaneous without creating competing free scroll.
  intermediate: Keep only one supporting rail persistent and move the other to a drawer.
  compact: Use one manuscript column; outline and notes open as named sheets and return to the exact text anchor.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: reader → document-outline → readable-manuscript → anchored-annotations → reading-position-and-bookmarks
  navigationReplacement: Use one manuscript column with named outline and notes sheets; close returns to the exact text anchor.
  stickyBehavior: No reading aid is sticky at short height.
  overflowOwner: Page flow owns manuscript reading; sheets own temporary internal overflow only.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
