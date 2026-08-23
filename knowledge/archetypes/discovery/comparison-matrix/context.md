# Comparison matrix

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `comparison-matrix` |
| Family | Discovery |
| Dominant task | Choose among at least three alternatives using one stable attribute set and explicit differences. |
| Search aliases | `comparison matrix, feature comparison, contender matrix, compare alternatives` |
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
| `AR-CMX-01` | Choose among at least three alternatives using one stable attribute set and explicit differences. | Candidate when evidenced. |
| `AR-CMX-02` | Every region in `comparison → contender-headers → attribute-groups → value-matrix → difference-controls → shortlist-or-selection-handoff` is required and has a distinct owner. | Required for selection. |
| `AR-CMX-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-CMX-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-CMX-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-CMX-90` | Two-source diff or merge requires reconciliation. | Reject. |
| `AR-CMX-91` | A detail page has one subject and decision rail. | Reject. |
| `AR-CMX-92` | A catalog precedes contender selection. | Reject. |

### Selection rule

Select `comparison-matrix` only when AR-CMX-01, AR-CMX-02, AR-CMX-03 are evidenced and none of AR-CMX-90, AR-CMX-91, AR-CMX-92 applies. Apply the responsive contract when AR-CMX-04 occurs. Return `needs-evidence` when AR-CMX-05 cannot be proven.

## Region graph

```text
comparison
├─ contender-headers
├─ attribute-groups
├─ value-matrix
├─ difference-controls
└─ shortlist-or-selection-handoff
```

Canonical relationship: `comparison → contender-headers → attribute-groups → value-matrix → difference-controls → shortlist-or-selection-handoff`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `comparison` | Owns attribute-aligned evaluation of at least three selected alternatives; establishes contender set, attribute axis, difference mode, shortlist, and handoff selection for every child without absorbing child responsibilities. |
| `contender-headers` | owns contender identity and stable header-to-value association; consumes contender set, attribute axis, difference mode, shortlist, and handoff selection from `comparison` and publishes the same identity to `attribute-groups`. |
| `attribute-groups` | owns the semantic grouping and order of comparison attributes; consumes contender set, attribute axis, difference mode, shortlist, and handoff selection from `contender-headers` and publishes the same identity to `value-matrix`. |
| `value-matrix` | owns aligned values for every contender and attribute; consumes contender set, attribute axis, difference mode, shortlist, and handoff selection from `attribute-groups` and publishes the same identity to `difference-controls`. |
| `difference-controls` | owns same/different emphasis and contender chooser state; consumes contender set, attribute axis, difference mode, shortlist, and handoff selection from `value-matrix` and publishes the same identity to `shortlist-or-selection-handoff`. |
| `shortlist-or-selection-handoff` | owns shortlist or selection output and stops before billing, payment, or fulfillment; consumes contender set, attribute axis, difference mode, shortlist, and handoff selection from `difference-controls` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Show the full matrix in one bounded region with contender identity persistently associated and differences conveyed beyond color.
- **Navigation replacement:** No replacement; full contender headers and value matrix remain associated in a bounded region.
- **Sticky boundary:** Header persistence is allowed only inside the matrix and must not obscure focused cells.
- **Overflow owner:** The value matrix owns bounded horizontal overflow; page flow owns vertical groups.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Limit simultaneous contenders with an explicit chooser while attribute identity remains attached to every value.
- **Navigation replacement:** Limit simultaneous contenders and provide an explicit chooser while keeping attribute identity attached to values.
- **Sticky boundary:** Chooser is modal only while open and returns focus to its trigger.
- **Overflow owner:** The bounded matrix owns horizontal overflow; chooser owns only its temporary list.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Compare two selected contenders at a time in grouped attribute rows; changing a contender preserves the shortlist.
- **Navigation replacement:** Compare two selected contenders at a time in grouped attribute rows; changing a contender preserves shortlist.
- **Sticky boundary:** No matrix header is page-sticky at short height.
- **Overflow owner:** Grouped rows own page flow; no page-level horizontal scroll is introduced.

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
| Initial/loading | `contender-headers` | Load one or more contender values loading independently without replacing the last committed contender set, attribute axis, difference mode, shortlist, and handoff selection. | Retain the last safe context in every band. |
| Ready | `difference-controls` | Expose stable headers, grouped attributes, values, and shortlist as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `attribute-groups` | Represent unavailable attribute distinguished from equal or empty value; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `difference-controls` | When one contender fails while other aligned values remain comparable, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `difference-controls` | Represent incompatible option or unavailable contender named explicitly; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `shortlist-or-selection-handoff` | While contender add/remove, difference filter, or handoff, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `shortlist-or-selection-handoff` | After shortlist or selection handoff completes without starting a transaction, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `difference-controls` | When contender data changes after a shortlist was formed, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `contender-headers` | compact contender chooser returns focus and preserves shortlist and attribute position. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `comparison` | Resize preserves contender set, attribute axis, difference mode, shortlist, and handoff selection, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Choose among at least three alternatives using one stable attribute set and explicit differences.
- Every required region and the relationship `comparison → contender-headers → attribute-groups → value-matrix → difference-controls → shortlist-or-selection-handoff` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Two-source diff or merge requires reconciliation.
- A detail page has one subject and decision rail.
- A catalog precedes contender selection.
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
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | structured scanning, sorting, and bounded tabular regions | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | keyboard access to two-dimensional information | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: comparison-matrix
situationCodes: AR-CMX-01, AR-CMX-02, AR-CMX-03, AR-CMX-04, AR-CMX-05
searchAliases: comparison matrix, feature comparison, contender matrix, compare alternatives
dominantTask: Choose among at least three alternatives using one stable attribute set and explicit differences.
regions: comparison, contender-headers, attribute-groups, value-matrix, difference-controls, shortlist-or-selection-handoff
regionRelationships: comparison → contender-headers → attribute-groups → value-matrix → difference-controls → shortlist-or-selection-handoff
responsive:
  wide: Show the full matrix in one bounded region with contender identity persistently associated and differences conveyed beyond color.
  intermediate: Limit simultaneous contenders with an explicit chooser while attribute identity remains attached to every value.
  compact: Compare two selected contenders at a time in grouped attribute rows; changing a contender preserves the shortlist.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: comparison → contender-headers → attribute-groups → value-matrix → difference-controls → shortlist-or-selection-handoff
  navigationReplacement: Compare two selected contenders at a time in grouped attribute rows; changing a contender preserves shortlist.
  stickyBehavior: No matrix header is page-sticky at short height.
  overflowOwner: Grouped rows own page flow; no page-level horizontal scroll is introduced.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
