# Calendar agenda browser

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `calendar-agenda-browser` |
| Family | Discovery |
| Dominant task | Browse events by date range and inspect an event without allocating resources. |
| Search aliases | `calendar agenda, event browser, date explorer, schedule viewer` |
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
| `AR-CAB-01` | Browse events by date range and inspect an event without allocating resources. | Candidate when evidenced. |
| `AR-CAB-02` | Every region in `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail` is required and has a distinct owner. | Required for selection. |
| `AR-CAB-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-CAB-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-CAB-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-CAB-90` | Resource allocation and collision resolution require a scheduling workbench. | Reject. |
| `AR-CAB-91` | Past causal investigation requires an audit timeline. | Reject. |
| `AR-CAB-92` | One event form is a bounded task. | Reject. |

### Selection rule

Select `calendar-agenda-browser` only when AR-CAB-01, AR-CAB-02, AR-CAB-03 are evidenced and none of AR-CAB-90, AR-CAB-91, AR-CAB-92 applies. Apply the responsive contract when AR-CAB-04 occurs. Return `needs-evidence` when AR-CAB-05 cannot be proven.

## Region graph

```text
calendar-browser
├─ date-range-navigation
├─ calendar-index
├─ agenda-list
└─ selected-event-detail
```

Canonical relationship: `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `calendar-browser` | Owns time-context browsing with synchronized calendar and agenda indexes; establishes date range, selected date, selected event, timezone, and source status for every child without absorbing child responsibilities. |
| `date-range-navigation` | owns date movement, horizon, Today return, and timezone context; consumes date range, selected date, selected event, timezone, and source status from `calendar-browser` and publishes the same identity to `calendar-index`. |
| `calendar-index` | owns the bounded calendar representation and publishes selected date or event; consumes date range, selected date, selected event, timezone, and source status from `date-range-navigation` and publishes the same identity to `agenda-list`. |
| `agenda-list` | owns semantic event order for the same range and selection; consumes date range, selected date, selected event, timezone, and source status from `calendar-index` and publishes the same identity to `selected-event-detail`. |
| `selected-event-detail` | owns facts for the shared selected event without becoming a scheduling form; consumes date range, selected date, selected event, timezone, and source status from `agenda-list` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep calendar and agenda or detail simultaneous when calendar cells retain usable measure.
- **Navigation replacement:** No replacement; calendar and agenda/detail may remain simultaneous when date cells and event text stay usable.
- **Sticky boundary:** Date-range controls may persist only with reserved space; detail never obscures calendar focus.
- **Overflow owner:** Calendar owns bounded two-dimensional navigation only when required; agenda owns semantic page flow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Reduce the time horizon and move detail to an overlay before seven columns become unreadable.
- **Navigation replacement:** Reduce the time horizon and move detail into an overlay instead of squeezing calendar columns.
- **Sticky boundary:** The overlay returns focus to the selected event or date.
- **Overflow owner:** Calendar owns its bounded grid; agenda remains in page flow.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Make agenda primary; calendar or date picker is an alternate view and event detail preserves the selected date.
- **Navigation replacement:** Make agenda primary; expose calendar/date picker as an alternate view and event detail as a sheet or screen.
- **Sticky boundary:** No calendar surface is sticky at short height.
- **Overflow owner:** The active agenda owns page flow or the active calendar owns its bounded grid; never both.

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
| Initial/loading | `date-range-navigation` | Load date range and calendar sources loading independently without replacing the last committed date range, selected date, selected event, timezone, and source status. | Retain the last safe context in every band. |
| Ready | `agenda-list` | Expose selected date and event synchronized across calendar and agenda as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `calendar-index` | Represent no events for the selected date while navigation remains available; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `agenda-list` | When partial calendar source failure or deleted selected event, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `agenda-list` | Represent unavailable calendar source without implying no events; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `selected-event-detail` | While range change, source retry, or event detail load, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `selected-event-detail` | After Today return or retry completes at the same time context, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `agenda-list` | When recurring instance or timezone revision changes the displayed occurrence, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `date-range-navigation` | calendar↔agenda focus and detail close restore selected date and event. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `calendar-browser` | Resize preserves date range, selected date, selected event, timezone, and source status, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Browse events by date range and inspect an event without allocating resources.
- Every required region and the relationship `calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Resource allocation and collision resolution require a scheduling workbench.
- Past causal investigation requires an audit timeline.
- One event form is a bounded task.
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
| [W3C ARIA APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | keyboard access to two-dimensional information | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | structured scanning, sorting, and bounded tabular regions | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: calendar-agenda-browser
situationCodes: AR-CAB-01, AR-CAB-02, AR-CAB-03, AR-CAB-04, AR-CAB-05
searchAliases: calendar agenda, event browser, date explorer, schedule viewer
dominantTask: Browse events by date range and inspect an event without allocating resources.
regions: calendar-browser, date-range-navigation, calendar-index, agenda-list, selected-event-detail
regionRelationships: calendar-browser → date-range-navigation → calendar-index ↔ agenda-list → selected-event-detail
responsive:
  wide: Keep calendar and agenda or detail simultaneous when calendar cells retain usable measure.
  intermediate: Reduce the time horizon and move detail to an overlay before seven columns become unreadable.
  compact: Make agenda primary; calendar or date picker is an alternate view and event detail preserves the selected date.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: calendar-browser → date-range-navigation → calendar-index → agenda-list → selected-event-detail
  navigationReplacement: Make agenda primary; expose calendar/date picker as an alternate view and event detail as a sheet or screen.
  stickyBehavior: No calendar surface is sticky at short height.
  overflowOwner: The active agenda owns page flow or the active calendar owns its bounded grid; never both.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
