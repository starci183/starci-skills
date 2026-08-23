# Knowledge graph explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `knowledge-graph-explorer` |
| Family | Discovery |
| Dominant task | Explore many-to-many relationships, follow connections, and inspect node or edge context. |
| Search aliases | `knowledge graph, network explorer, relationship graph, node inspector` |
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
| `AR-KGE-01` | Explore many-to-many relationships, follow connections, and inspect node or edge context. | Candidate when evidenced. |
| `AR-KGE-02` | Every region in `graph-explorer → query-and-legend → graph-canvas → selected-node-or-edge → relationship-inspector → accessible-alternate-list` is required and has a distinct owner. | Required for selection. |
| `AR-KGE-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-KGE-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-KGE-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-KGE-90` | Single-parent hierarchy requires a hierarchy browser. | Reject. |
| `AR-KGE-91` | Dependency health monitoring owns status rather than exploration. | Reject. |
| `AR-KGE-92` | Decorative networks without selection are not explorers. | Reject. |

### Selection rule

Select `knowledge-graph-explorer` only when AR-KGE-01, AR-KGE-02, AR-KGE-03 are evidenced and none of AR-KGE-90, AR-KGE-91, AR-KGE-92 applies. Apply the responsive contract when AR-KGE-04 occurs. Return `needs-evidence` when AR-KGE-05 cannot be proven.

## Region graph

```text
graph-explorer
├─ query-and-legend
├─ graph-canvas
├─ selected-node-or-edge
├─ relationship-inspector
└─ accessible-alternate-list
```

Canonical relationship: `graph-explorer → query-and-legend → graph-canvas → selected-node-or-edge → relationship-inspector → accessible-alternate-list`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `graph-explorer` | Owns many-to-many relationship exploration with graph and semantic-list parity; establishes query, hidden filters, selected node or edge, path, and inspector state for every child without absorbing child responsibilities. |
| `query-and-legend` | owns graph scope, search, filters, and legend meaning; consumes query, hidden filters, selected node or edge, path, and inspector state from `graph-explorer` and publishes the same identity to `graph-canvas`. |
| `graph-canvas` | owns bounded spatial exploration of nodes and edges; consumes query, hidden filters, selected node or edge, path, and inspector state from `query-and-legend` and publishes the same identity to `selected-node-or-edge`. |
| `selected-node-or-edge` | owns the identity shared by canvas, list, and inspector; consumes query, hidden filters, selected node or edge, path, and inspector state from `graph-canvas` and publishes the same identity to `relationship-inspector`. |
| `relationship-inspector` | owns facts and traversable relationships for the shared selection; consumes query, hidden filters, selected node or edge, path, and inspector state from `selected-node-or-edge` and publishes the same identity to `accessible-alternate-list`. |
| `accessible-alternate-list` | owns a complete semantic list or path view with bidirectional selection parity; consumes query, hidden filters, selected node or edge, path, and inspector state from `relationship-inspector` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep graph and inspector simultaneous with bounded pan and zoom; legend and filters remain supporting.
- **Navigation replacement:** No replacement; graph canvas and inspector remain simultaneous with legend supporting.
- **Sticky boundary:** Inspector may persist only beside, never over, the canvas focus target.
- **Overflow owner:** Graph canvas owns bounded pan/zoom; alternate list and page flow own semantic reading.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Make the inspector temporary or collapsible so the graph retains usable scale.
- **Navigation replacement:** Move the inspector into a collapsible or temporary surface while graph scale remains usable.
- **Sticky boundary:** The inspector returns focus to the selected graph or list item.
- **Overflow owner:** Canvas keeps bounded interaction overflow; inspector owns only internal detail scroll.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Default to a relationship list or path drill-down; graph becomes an optional full-screen view with bidirectional selection parity.
- **Navigation replacement:** Default to relationship list or path drill-down; expose graph as an optional full-screen view.
- **Sticky boundary:** The graph view is modal only while open and yields at short height.
- **Overflow owner:** The active list owns page flow or the active graph owns bounded pan/zoom; never both simultaneously.

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
| Initial/loading | `query-and-legend` | Load graph data and alternate list loading together without replacing the last committed query, hidden filters, selected node or edge, path, and inspector state. | Retain the last safe context in every band. |
| Ready | `relationship-inspector` | Expose selected node or edge synchronized across graph, list, and inspector as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `graph-canvas` | Represent empty or isolated graph scope with query recovery; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `relationship-inspector` | When graph too large or layout recalculation failure with list fallback, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `relationship-inspector` | Represent permission-redacted relation named without inventing an edge; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `accessible-alternate-list` | While layout recalculation or relationship expansion, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `accessible-alternate-list` | After graph and alternate list confirm the same selection, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `relationship-inspector` | When filters or data revision invalidate a selected edge, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `query-and-legend` | graph↔list focus opens the same inspector and returns to the invoking representation. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `graph-explorer` | Resize preserves query, hidden filters, selected node or edge, path, and inspector state, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Explore many-to-many relationships, follow connections, and inspect node or edge context.
- Every required region and the relationship `graph-explorer → query-and-legend → graph-canvas → selected-node-or-edge → relationship-inspector → accessible-alternate-list` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Single-parent hierarchy requires a hierarchy browser.
- Dependency health monitoring owns status rather than exploration.
- Decorative networks without selection are not explorers.
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
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | structured scanning, sorting, and bounded tabular regions | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | keyboard and widget interaction models | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Cytoscape.js documentation](https://js.cytoscape.org/) | interactive graph selection, pan, zoom, and graph state | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: knowledge-graph-explorer
situationCodes: AR-KGE-01, AR-KGE-02, AR-KGE-03, AR-KGE-04, AR-KGE-05
searchAliases: knowledge graph, network explorer, relationship graph, node inspector
dominantTask: Explore many-to-many relationships, follow connections, and inspect node or edge context.
regions: graph-explorer, query-and-legend, graph-canvas, selected-node-or-edge, relationship-inspector, accessible-alternate-list
regionRelationships: graph-explorer → query-and-legend → graph-canvas → selected-node-or-edge → relationship-inspector → accessible-alternate-list
responsive:
  wide: Keep graph and inspector simultaneous with bounded pan and zoom; legend and filters remain supporting.
  intermediate: Make the inspector temporary or collapsible so the graph retains usable scale.
  compact: Default to a relationship list or path drill-down; graph becomes an optional full-screen view with bidirectional selection parity.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: graph-explorer → query-and-legend → graph-canvas → selected-node-or-edge → relationship-inspector → accessible-alternate-list
  navigationReplacement: Default to relationship list or path drill-down; expose graph as an optional full-screen view.
  stickyBehavior: The graph view is modal only while open and yields at short height.
  overflowOwner: The active list owns page flow or the active graph owns bounded pan/zoom; never both simultaneously.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
