# Spatial route itinerary explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spatial-route-itinerary-explorer` |
| Family | Discovery |
| Dominant task | Understand and choose route alternatives through ordered legs, constraints, duration, and spatial context before starting. |
| Search aliases | `route explorer, itinerary map, directions alternatives, trip legs` |
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
| `AR-SRI-01` | Understand and choose route alternatives through ordered legs, constraints, duration, and spatial context before starting. | Candidate when evidenced. |
| `AR-SRI-02` | Every region in `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route` is required and has a distinct owner. | Required for selection. |
| `AR-SRI-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-SRI-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-SRI-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-SRI-90` | Unordered place discovery requires map results. | Reject. |
| `AR-SRI-91` | Live dispatch editing is an operational workbench. | Reject. |
| `AR-SRI-92` | Calendar scheduling owns time allocation. | Reject. |

### Selection rule

Select `spatial-route-itinerary-explorer` only when AR-SRI-01, AR-SRI-02, AR-SRI-03 are evidenced and none of AR-SRI-90, AR-SRI-91, AR-SRI-92 applies. Apply the responsive contract when AR-SRI-04 occurs. Return `needs-evidence` when AR-SRI-05 cannot be proven.

## Region graph

```text
route-explorer
├─ origin-destination-and-constraints
├─ route-alternative-summary
├─ geographic-route-stage
├─ ordered-itinerary
├─ selected-leg-detail
└─ start-or-share-route
```

Canonical relationship: `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `route-explorer` | Owns pre-journey choice among ordered route alternatives with spatial context; establishes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor for every child without absorbing child responsibilities. |
| `origin-destination-and-constraints` | owns origin, destination, mode, accessibility, and route constraints; consumes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor from `route-explorer` and publishes the same identity to `route-alternative-summary`. |
| `route-alternative-summary` | owns comparable duration, warning, and route identity summaries; consumes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor from `origin-destination-and-constraints` and publishes the same identity to `geographic-route-stage`. |
| `geographic-route-stage` | owns bounded route geometry and publishes selected leg identity; consumes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor from `route-alternative-summary` and publishes the same identity to `ordered-itinerary`. |
| `ordered-itinerary` | owns ordered stops and legs and consumes the same selected leg; consumes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor from `geographic-route-stage` and publishes the same identity to `selected-leg-detail`. |
| `selected-leg-detail` | owns facts and warnings for the shared selected leg; consumes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor from `ordered-itinerary` and publishes the same identity to `start-or-share-route`. |
| `start-or-share-route` | owns start or share handoff without becoming live dispatch editing; consumes origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor from `selected-leg-detail` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep map and itinerary simultaneous while route alternative and leg selection remain synchronized and map pan or zoom stays bounded.
- **Navigation replacement:** No replacement; map and ordered itinerary remain simultaneous with alternatives and selected leg synchronized.
- **Sticky boundary:** Map may persist only within its allocated region and never cover itinerary focus.
- **Overflow owner:** Map owns bounded pan/zoom; itinerary owns one semantic vertical reading axis.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Keep the evidence-backed itinerary or map primary while selected-leg summary and route chooser remain visible when the other region collapses.
- **Navigation replacement:** Keep the evidenced primary map or itinerary visible; keep route chooser and selected-leg summary visible when the other region collapses.
- **Sticky boundary:** Collapsed map or detail returns focus to the exact route or leg trigger.
- **Overflow owner:** Only the active map or itinerary owns interaction overflow.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Use an itinerary-first ordered sequence; map is an alternate full-screen view and closing leg detail restores stop, scroll, and viewport state.
- **Navigation replacement:** Use itinerary-first ordered legs; open map as an alternate full-screen view and leg detail as a returning sheet.
- **Sticky boundary:** The map or leg sheet is modal only while open and yields at short height.
- **Overflow owner:** Itinerary owns page flow; optional map owns bounded pan/zoom only while active.

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
| Initial/loading | `origin-destination-and-constraints` | Load route calculation and map rendering independently without replacing the last committed origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor. | Retain the last safe context in every band. |
| Ready | `selected-leg-detail` | Expose selected alternative and leg synchronized between map and itinerary as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `route-alternative-summary` | Represent no route or partial route with constraint recovery; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `selected-leg-detail` | When map failure with itinerary parity or route calculation failure, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `selected-leg-detail` | Represent map unavailable without blocking ordered itinerary; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `start-or-share-route` | While route calculation, share, or start handoff, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `start-or-share-route` | After share or start handoff completes at the same selected route and leg, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `selected-leg-detail` | When closure or reroute makes the calculated route stale, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `origin-destination-and-constraints` | map↔leg focus and detail close restore exact stop, scroll, and viewport state. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `route-explorer` | Resize preserves origin, destination, constraints, selected route, selected leg, map viewport, and itinerary anchor, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Understand and choose route alternatives through ordered legs, constraints, duration, and spatial context before starting.
- Every required region and the relationship `route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Unordered place discovery requires map results.
- Live dispatch editing is an operational workbench.
- Calendar scheduling owns time allocation.
- Dependency graphs are not geographic routes.
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
| [Google Maps Platform — Routes API](https://developers.google.com/maps/documentation/routes) | route alternatives, legs, steps, and route constraints | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: spatial-route-itinerary-explorer
situationCodes: AR-SRI-01, AR-SRI-02, AR-SRI-03, AR-SRI-04, AR-SRI-05
searchAliases: route explorer, itinerary map, directions alternatives, trip legs
dominantTask: Understand and choose route alternatives through ordered legs, constraints, duration, and spatial context before starting.
regions: route-explorer, origin-destination-and-constraints, route-alternative-summary, geographic-route-stage, ordered-itinerary, selected-leg-detail, start-or-share-route
regionRelationships: route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage ↔ ordered-itinerary → selected-leg-detail → start-or-share-route
responsive:
  wide: Keep map and itinerary simultaneous while route alternative and leg selection remain synchronized and map pan or zoom stays bounded.
  intermediate: Keep the evidence-backed itinerary or map primary while selected-leg summary and route chooser remain visible when the other region collapses.
  compact: Use an itinerary-first ordered sequence; map is an alternate full-screen view and closing leg detail restores stop, scroll, and viewport state.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: route-explorer → origin-destination-and-constraints → route-alternative-summary → geographic-route-stage → ordered-itinerary → selected-leg-detail → start-or-share-route
  navigationReplacement: Use itinerary-first ordered legs; open map as an alternate full-screen view and leg detail as a returning sheet.
  stickyBehavior: The map or leg sheet is modal only while open and yields at short height.
  overflowOwner: Itinerary owns page flow; optional map owns bounded pan/zoom only while active.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
