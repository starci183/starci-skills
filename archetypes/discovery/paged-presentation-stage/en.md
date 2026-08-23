# Paged presentation stage

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `paged-presentation-stage` |
| Family | Discovery |
| Dominant task | Move through discrete frames in order with thumbnails, progress, and optional presenter notes. |
| Search aliases | `slide viewer, presentation stage, paged deck, frame navigator` |
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
| `AR-PPS-01` | Move through discrete frames in order with thumbnails, progress, and optional presenter notes. | Candidate when evidenced. |
| `AR-PPS-02` | Every region in `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes` is required and has a distinct owner. | Required for selection. |
| `AR-PPS-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-PPS-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-PPS-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-PPS-90` | Continuous media requires a theater queue. | Reject. |
| `AR-PPS-91` | Editable canvas requires an authoring workbench. | Reject. |
| `AR-PPS-92` | Long-form documents require a manuscript reader. | Reject. |

### Selection rule

Select `paged-presentation-stage` only when AR-PPS-01, AR-PPS-02, AR-PPS-03 are evidenced and none of AR-PPS-90, AR-PPS-91, AR-PPS-92 applies. Apply the responsive contract when AR-PPS-04 occurs. Return `needs-evidence` when AR-PPS-05 cannot be proven.

## Region graph

```text
presentation
├─ thumbnail-navigator
├─ primary-stage
├─ previous-next-progress
└─ presenter-notes
```

Canonical relationship: `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `presentation` | Owns ordered navigation through discrete frames with orientation aids; establishes current frame, visited frames, progress, fullscreen state, and notes availability for every child without absorbing child responsibilities. |
| `thumbnail-navigator` | owns direct frame selection and visited-frame orientation; consumes current frame, visited frames, progress, fullscreen state, and notes availability from `presentation` and publishes the same identity to `primary-stage`. |
| `primary-stage` | owns the discrete current frame and preserves its aspect relationship; consumes current frame, visited frames, progress, fullscreen state, and notes availability from `thumbnail-navigator` and publishes the same identity to `previous-next-progress`. |
| `previous-next-progress` | owns deterministic previous/next movement and current count; consumes current frame, visited frames, progress, fullscreen state, and notes availability from `primary-stage` and publishes the same identity to `presenter-notes`. |
| `presenter-notes` | owns optional presenter context for the current frame; consumes current frame, visited frames, progress, fullscreen state, and notes availability from `previous-next-progress` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep thumbnails, aspect-preserving stage, and notes simultaneous only while the stage remains primary and keyboard focus stays outside the canvas.
- **Navigation replacement:** No replacement; thumbnails, primary stage, and notes may coexist when the stage stays usable.
- **Sticky boundary:** Stage controls may persist only within reserved space; notes never overlay focused stage content.
- **Overflow owner:** Thumbnail navigator may own bounded vertical overflow; stage owns no page scroll.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Collapse notes or thumbnails according to task priority before the stage loses useful size.
- **Navigation replacement:** Move notes or thumbnails into a collapsible region according to task priority.
- **Sticky boundary:** Temporary region returns focus to its exact trigger.
- **Overflow owner:** Page flow owns the stage; temporary navigation owns only its internal list.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Keep stage, explicit previous and next, and current count primary; thumbnails and notes open in sheets without swipe dependence.
- **Navigation replacement:** Keep stage, explicit Previous/Next, and current count in sequence; open thumbnails and notes in sheets.
- **Sticky boundary:** Controls reserve space and yield at short height.
- **Overflow owner:** Page flow owns the stage; sheets own temporary internal overflow.

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
| Initial/loading | `thumbnail-navigator` | Load deck and current frame loading without replacing the last committed current frame, visited frames, progress, fullscreen state, and notes availability. | Retain the last safe context in every band. |
| Ready | `previous-next-progress` | Expose current frame, visited state, progress, and notes as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `primary-stage` | Represent missing frame or unavailable notes with navigation retained; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `previous-next-progress` | When frame load or fullscreen failure at the current index, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `previous-next-progress` | Represent notes unavailable without blocking frame navigation; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `presenter-notes` | While frame change, fullscreen entry, or notes load, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `presenter-notes` | After frame change or fullscreen exit completes at the same deck position, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `previous-next-progress` | When deck revision invalidates a visited or current frame, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `thumbnail-navigator` | stage↔thumbnail focus and sheet close return to the exact frame trigger. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `presentation` | Resize preserves current frame, visited frames, progress, fullscreen state, and notes availability, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Move through discrete frames in order with thumbnails, progress, and optional presenter notes.
- Every required region and the relationship `presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Continuous media requires a theater queue.
- Editable canvas requires an authoring workbench.
- Long-form documents require a manuscript reader.
- Assessment questions have session submission semantics.
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
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | adaptive layout and content priority | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA APG — Carousel Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/) | explicit sequential controls and announced position | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: paged-presentation-stage
situationCodes: AR-PPS-01, AR-PPS-02, AR-PPS-03, AR-PPS-04, AR-PPS-05
searchAliases: slide viewer, presentation stage, paged deck, frame navigator
dominantTask: Move through discrete frames in order with thumbnails, progress, and optional presenter notes.
regions: presentation, thumbnail-navigator, primary-stage, previous-next-progress, presenter-notes
regionRelationships: presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes
responsive:
  wide: Keep thumbnails, aspect-preserving stage, and notes simultaneous only while the stage remains primary and keyboard focus stays outside the canvas.
  intermediate: Collapse notes or thumbnails according to task priority before the stage loses useful size.
  compact: Keep stage, explicit previous and next, and current count primary; thumbnails and notes open in sheets without swipe dependence.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: presentation → thumbnail-navigator → primary-stage → previous-next-progress → presenter-notes
  navigationReplacement: Keep stage, explicit Previous/Next, and current count in sequence; open thumbnails and notes in sheets.
  stickyBehavior: Controls reserve space and yield at short height.
  overflowOwner: Page flow owns the stage; sheets own temporary internal overflow.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
