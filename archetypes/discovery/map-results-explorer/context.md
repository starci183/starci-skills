# Map results explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `map-results-explorer` |
| Family | Discovery |
| Dominant task | Find and evaluate choices through spatial relationships with map and result list acting as synchronized indexes. |
| Search aliases | `map search, places map, spatial results, map list explorer` |
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
| `AR-MRE-01` | Find and evaluate choices through spatial relationships with map and result list acting as synchronized indexes. | Candidate when evidenced. |
| `AR-MRE-02` | Every region in `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls` is required and has a distinct owner. | Required for selection. |
| `AR-MRE-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-MRE-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-MRE-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-MRE-90` | A map whose removal leaves the task unchanged is decorative. | Reject. |
| `AR-MRE-91` | Hierarchy is not spatial discovery. | Reject. |
| `AR-MRE-92` | Status reporting on a map requires a monitoring archetype. | Reject. |

### Selection rule

Select `map-results-explorer` only when AR-MRE-01, AR-MRE-02, AR-MRE-03 are evidenced and none of AR-MRE-90, AR-MRE-91, AR-MRE-92 applies. Apply the responsive contract when AR-MRE-04 occurs. Return `needs-evidence` when AR-MRE-05 cannot be proven.

## Region graph

```text
spatial-explorer
├─ place-query-filters
├─ map-index
├─ synchronized-result-list
├─ selected-place-detail
└─ map-controls
```

Canonical relationship: `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `spatial-explorer` | Owns the spatial choice set and bidirectional map–result selection; establishes query, filters, selected place, map viewport, and list position for every child without absorbing child responsibilities. |
| `place-query-filters` | owns the spatial exploration session and selection parity; consumes query, filters, selected place, map viewport, and list position from `spatial-explorer` and publishes the same identity to `map-index`. |
| `map-index` | owns place intent and committed spatial constraints; consumes query, filters, selected place, map viewport, and list position from `place-query-filters` and publishes the same identity to `synchronized-result-list`. |
| `synchronized-result-list` | indexes choices by geographic position and publishes marker selection; consumes query, filters, selected place, map viewport, and list position from `map-index` and publishes the same identity to `selected-place-detail`. |
| `selected-place-detail` | indexes the same choices in semantic reading order and publishes result selection; consumes query, filters, selected place, map viewport, and list position from `synchronized-result-list` and publishes the same identity to `map-controls`. |
| `map-controls` | owns facts and actions for the shared selected place; consumes query, filters, selected place, map viewport, and list position from `selected-place-detail` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep map and list or detail simultaneous with one results scroll owner and bounded map pan and zoom.
- **Navigation replacement:** No replacement; map and synchronized list/detail remain simultaneous.
- **Sticky boundary:** The map may persist only within its allocated region and never cover focused results.
- **Overflow owner:** The map owns bounded pan/zoom; the result list owns one bounded vertical axis when simultaneity requires it.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Keep the evidence-backed primary index persistent and collapse the other while a selected-place summary remains reachable.
- **Navigation replacement:** Keep the evidenced primary index visible and collapse the other behind a named control while selected-place summary remains reachable.
- **Sticky boundary:** The collapsed index is not sticky and returns focus to its trigger.
- **Overflow owner:** Only the active map or list owns interaction overflow; hidden topology creates no scroll.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Provide an explicit Map or List switch; detail closes back to the exact viewport or list position.
- **Navigation replacement:** Use an explicit Map/List switch; detail close restores the exact map viewport or list anchor.
- **Sticky boundary:** The selected-place sheet is modal only while open and yields at short height.
- **Overflow owner:** The active view owns overflow; the inactive view is removed from interaction and focus.

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
| Initial/loading | `place-query-filters` | Load map and list loading with geolocation outcome separated without replacing the last committed query, filters, selected place, map viewport, and list position. | Retain the last safe context in every band. |
| Ready | `selected-place-detail` | Expose selected marker and result with synchronized detail as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `map-index` | Represent no places in the current viewport with query expansion recovery; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `selected-place-detail` | When map failure with list parity or list partial failure with map context, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `selected-place-detail` | Represent geolocation denied or unavailable without blocking manual search; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `map-controls` | While viewport query update, retry, or place action, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `map-controls` | After map and list confirm the same selected place, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `selected-place-detail` | When selected marker moves offscreen or result set changes after viewport update, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `place-query-filters` | marker↔result focus and detail close restore the exact viewport or list position. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `spatial-explorer` | Resize preserves query, filters, selected place, map viewport, and list position, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Find and evaluate choices through spatial relationships with map and result list acting as synchronized indexes.
- Every required region and the relationship `spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- A map whose removal leaves the task unchanged is decorative.
- Hierarchy is not spatial discovery.
- Status reporting on a map requires a monitoring archetype.
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
| [Apple Human Interface Guidelines — Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | adaptive layout and content priority | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | keyboard and widget interaction models | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Google Maps Platform — Accessibility](https://developers.google.com/maps/documentation/javascript/advanced-markers/accessible-markers) | keyboard and non-visual access for spatial interfaces | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: map-results-explorer
situationCodes: AR-MRE-01, AR-MRE-02, AR-MRE-03, AR-MRE-04, AR-MRE-05
searchAliases: map search, places map, spatial results, map list explorer
dominantTask: Find and evaluate choices through spatial relationships with map and result list acting as synchronized indexes.
regions: spatial-explorer, place-query-filters, map-index, synchronized-result-list, selected-place-detail, map-controls
regionRelationships: spatial-explorer → place-query-filters → map-index ↔ synchronized-result-list → selected-place-detail → map-controls
responsive:
  wide: Keep map and list or detail simultaneous with one results scroll owner and bounded map pan and zoom.
  intermediate: Keep the evidence-backed primary index persistent and collapse the other while a selected-place summary remains reachable.
  compact: Provide an explicit Map or List switch; detail closes back to the exact viewport or list position.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: spatial-explorer → place-query-filters → map-index → synchronized-result-list → selected-place-detail → map-controls
  navigationReplacement: Use an explicit Map/List switch; detail close restores the exact map viewport or list anchor.
  stickyBehavior: The selected-place sheet is modal only while open and yields at short height.
  overflowOwner: The active view owns overflow; the inactive view is removed from interaction and focus.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
