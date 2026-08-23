# Timeline audit explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `timeline-audit-explorer` |
| Family | Discovery |
| Dominant task | Reconstruct the order, correlation, and causes of events that already occurred. |
| Search aliases | `audit timeline, event investigation, causal history, correlated events` |
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
| `AR-TAE-01` | Reconstruct the order, correlation, and causes of events that already occurred. | Candidate when evidenced. |
| `AR-TAE-02` | Every region in `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence` is required and has a distinct owner. | Required for selection. |
| `AR-TAE-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-TAE-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-TAE-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-TAE-90` | Conversational activity feeds do not investigate causality. | Reject. |
| `AR-TAE-91` | Raw append-only logs lack correlation structure. | Reject. |
| `AR-TAE-92` | Scheduling and status timelines own future or state progression. | Reject. |

### Selection rule

Select `timeline-audit-explorer` only when AR-TAE-01, AR-TAE-02, AR-TAE-03 are evidenced and none of AR-TAE-90, AR-TAE-91, AR-TAE-92 applies. Apply the responsive contract when AR-TAE-04 occurs. Return `needs-evidence` when AR-TAE-05 cannot be proven.

## Region graph

```text
audit-explorer
├─ time-and-actor-filters
├─ chronological-spine
├─ correlation-groups
├─ selected-event-detail
└─ related-evidence
```

Canonical relationship: `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `audit-explorer` | Owns the forensic event sequence, correlations, and causal evidence; establishes time range, actor filters, chronological position, group, and selected event for every child without absorbing child responsibilities. |
| `time-and-actor-filters` | owns the investigation session and chronological interpretation; consumes time range, actor filters, chronological position, group, and selected event from `audit-explorer` and publishes the same identity to `chronological-spine`. |
| `chronological-spine` | owns committed time, actor, source, and timezone constraints; consumes time range, actor filters, chronological position, group, and selected event from `time-and-actor-filters` and publishes the same identity to `correlation-groups`. |
| `correlation-groups` | owns timestamp order as the semantic axis; consumes time range, actor filters, chronological position, group, and selected event from `chronological-spine` and publishes the same identity to `selected-event-detail`. |
| `selected-event-detail` | owns correlation identity across events without changing timestamp order; consumes time range, actor filters, chronological position, group, and selected event from `correlation-groups` and publishes the same identity to `related-evidence`. |
| `related-evidence` | owns the selected event payload and causal context; consumes time range, actor filters, chronological position, group, and selected event from `selected-event-detail` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep timeline and detail rail simultaneous while group markers and the time scale remain readable.
- **Navigation replacement:** No replacement; filters, chronological spine, and detail remain visible when the time scale stays legible.
- **Sticky boundary:** Only filters may persist when reserved space keeps event focus visible; detail does not float over the spine.
- **Overflow owner:** Chronological page flow owns vertical reading; related evidence may scroll only inside a bounded detail rail.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Move detail into a drawer so the chronological spine retains width and reading continuity.
- **Navigation replacement:** Move event detail to a drawer and keep the chronological spine at readable width.
- **Sticky boundary:** The drawer traps focus only while modal and returns to the selected event.
- **Overflow owner:** The spine owns page flow; the drawer owns only its internal detail scroll.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Render one chronological stream with group headings; detail returns to the exact event anchor.
- **Navigation replacement:** Use one chronological event stream with group headings; detail Back returns to the exact event anchor.
- **Sticky boundary:** No timeline surface is sticky at short height.
- **Overflow owner:** Page flow owns the event stream; the detail sheet owns only temporary internal overflow.

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
| Initial/loading | `time-and-actor-filters` | Load time range and source loading without replacing the last committed time range, actor filters, chronological position, group, and selected event. | Retain the last safe context in every band. |
| Ready | `selected-event-detail` | Expose ordered events, expanded correlation group, and selected event as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `chronological-spine` | Represent no events in the committed range; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `selected-event-detail` | When partial source failure or deleted selected event, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `selected-event-detail` | Represent unavailable evidence source named without implying absence; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `related-evidence` | While range refresh, event detail load, or export, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `related-evidence` | After export or source retry completes at the same event anchor, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `selected-event-detail` | When late-arriving event changes sequence or correlation, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `time-and-actor-filters` | detail close and compact Back restore the selected event anchor. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `audit-explorer` | Resize preserves time range, actor filters, chronological position, group, and selected event, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Reconstruct the order, correlation, and causes of events that already occurred.
- Every required region and the relationship `audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Conversational activity feeds do not investigate causality.
- Raw append-only logs lack correlation structure.
- Scheduling and status timelines own future or state progression.
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
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Purview — Search the audit log](https://learn.microsoft.com/en-us/purview/audit-search) | time, actor, activity, detail, and partial audit investigation | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: timeline-audit-explorer
situationCodes: AR-TAE-01, AR-TAE-02, AR-TAE-03, AR-TAE-04, AR-TAE-05
searchAliases: audit timeline, event investigation, causal history, correlated events
dominantTask: Reconstruct the order, correlation, and causes of events that already occurred.
regions: audit-explorer, time-and-actor-filters, chronological-spine, correlation-groups, selected-event-detail, related-evidence
regionRelationships: audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence
responsive:
  wide: Keep timeline and detail rail simultaneous while group markers and the time scale remain readable.
  intermediate: Move detail into a drawer so the chronological spine retains width and reading continuity.
  compact: Render one chronological stream with group headings; detail returns to the exact event anchor.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: audit-explorer → time-and-actor-filters → chronological-spine → correlation-groups → selected-event-detail → related-evidence
  navigationReplacement: Use one chronological event stream with group headings; detail Back returns to the exact event anchor.
  stickyBehavior: No timeline surface is sticky at short height.
  overflowOwner: Page flow owns the event stream; the detail sheet owns only temporary internal overflow.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
