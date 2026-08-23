# Hierarchical three-pane explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `hierarchical-three-pane-explorer` |
| Family | Discovery |
| Dominant task | Traverse three true parent-child levels and inspect a leaf without losing parent or child position. |
| Search aliases | `three pane explorer, hierarchy detail, parent child leaf, column browser` |
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
| `AR-H3P-01` | Traverse three true parent-child levels and inspect a leaf without losing parent or child position. | Candidate when evidenced. |
| `AR-H3P-02` | Every region in `explorer → primary-hierarchy → child-collection → leaf-detail` is required and has a distinct owner. | Required for selection. |
| `AR-H3P-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-H3P-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-H3P-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-H3P-90` | A list-detail surface has no independent third level. | Reject. |
| `AR-H3P-91` | Decorative sidebars do not establish hierarchy. | Reject. |
| `AR-H3P-92` | Many-to-many relationships require a graph explorer. | Reject. |

### Selection rule

Select `hierarchical-three-pane-explorer` only when AR-H3P-01, AR-H3P-02, AR-H3P-03 are evidenced and none of AR-H3P-90, AR-H3P-91, AR-H3P-92 applies. Apply the responsive contract when AR-H3P-04 occurs. Return `needs-evidence` when AR-H3P-05 cannot be proven.

## Region graph

```text
explorer
├─ primary-hierarchy
├─ child-collection
└─ leaf-detail
```

Canonical relationship: `explorer → primary-hierarchy → child-collection → leaf-detail`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `explorer` | Owns the three-level parent–child–leaf path and its independent selections; establishes selected primary node, selected child, leaf identity, and restoration path for every child without absorbing child responsibilities. |
| `primary-hierarchy` | selects and expands the first hierarchy level and publishes the parent path; consumes selected primary node, selected child, leaf identity, and restoration path from `explorer` and publishes the same identity to `child-collection`. |
| `child-collection` | owns peer selection within the selected parent and preserves its collection position; consumes selected primary node, selected child, leaf identity, and restoration path from `primary-hierarchy` and publishes the same identity to `leaf-detail`. |
| `leaf-detail` | owns leaf reading and leaf actions while retaining the parent and child path; consumes selected primary node, selected child, leaf identity, and restoration path from `child-collection` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Show all three panes only while every pane has usable measure; navigation panes retain path and detail owns reading and actions.
- **Navigation replacement:** No replacement while all three panes retain usable selection and reading.
- **Sticky boundary:** No pane is sticky by default; each pane must expose its path without covering focus.
- **Overflow owner:** Each visible pane may own bounded vertical overflow only when its selection position must persist.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Move the primary hierarchy to a drawer while child collection and leaf detail remain simultaneous and the selected path stays visible.
- **Navigation replacement:** Move the primary hierarchy into a drawer and keep the selected path visible above child and detail.
- **Sticky boundary:** The drawer is modal only while open and returns focus to its path trigger.
- **Overflow owner:** Child and detail retain one declared scroll owner; the drawer owns only its internal list.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Sequence primary, child, then detail as separate stages with explicit path, Back, and per-stage state restoration.
- **Navigation replacement:** Sequence primary → child → detail with explicit Back and path headings.
- **Sticky boundary:** No stage is sticky; Back remains reachable in normal flow.
- **Overflow owner:** The active stage owns page flow; inactive stages create no scroll container.

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
| Initial/loading | `primary-hierarchy` | Load node expansion and child collection loading without replacing the last committed selected primary node, selected child, leaf identity, and restoration path. | Retain the last safe context in every band. |
| Ready | `child-collection` | Expose selected parent, child, and leaf path as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `child-collection` | Represent an empty child collection or orphaned leaf; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `child-collection` | When child load failure or deleted leaf with path retained, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `child-collection` | Represent permission denial at the exact affected level; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `leaf-detail` | While node expansion or leaf recovery, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `leaf-detail` | After restored parent–child–leaf path, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `child-collection` | When stale path after move, rename, or deletion, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `primary-hierarchy` | stage Back and drawer close restore the exact prior selection. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `explorer` | Resize preserves selected primary node, selected child, leaf identity, and restoration path, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Traverse three true parent-child levels and inspect a leaf without losing parent or child position.
- Every required region and the relationship `explorer → primary-hierarchy → child-collection → leaf-detail` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- A list-detail surface has no independent third level.
- Decorative sidebars do not establish hierarchy.
- Many-to-many relationships require a graph explorer.
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
| [W3C ARIA APG — Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | hierarchy semantics, selection, and keyboard movement | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | navigation, disclosure, and selection behavior | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: hierarchical-three-pane-explorer
situationCodes: AR-H3P-01, AR-H3P-02, AR-H3P-03, AR-H3P-04, AR-H3P-05
searchAliases: three pane explorer, hierarchy detail, parent child leaf, column browser
dominantTask: Traverse three true parent-child levels and inspect a leaf without losing parent or child position.
regions: explorer, primary-hierarchy, child-collection, leaf-detail
regionRelationships: explorer → primary-hierarchy → child-collection → leaf-detail
responsive:
  wide: Show all three panes only while every pane has usable measure; navigation panes retain path and detail owns reading and actions.
  intermediate: Move the primary hierarchy to a drawer while child collection and leaf detail remain simultaneous and the selected path stays visible.
  compact: Sequence primary, child, then detail as separate stages with explicit path, Back, and per-stage state restoration.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: explorer → primary-hierarchy → child-collection → leaf-detail
  navigationReplacement: Sequence primary → child → detail with explicit Back and path headings.
  stickyBehavior: No stage is sticky; Back remains reachable in normal flow.
  overflowOwner: The active stage owns page flow; inactive stages create no scroll container.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
