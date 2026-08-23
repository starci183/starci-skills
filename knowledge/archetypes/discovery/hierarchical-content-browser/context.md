# Hierarchical content browser

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `hierarchical-content-browser` |
| Family | Discovery |
| Dominant task | Traverse a taxonomy or folder tree and inspect the content index owned by the current node. |
| Search aliases | `taxonomy browser, folder browser, content tree, hierarchical index` |
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
| `AR-HCB-01` | Traverse a taxonomy or folder tree and inspect the content index owned by the current node. | Candidate when evidenced. |
| `AR-HCB-02` | Every region in `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview` is required and has a distinct owner. | Required for selection. |
| `AR-HCB-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-HCB-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-HCB-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-HCB-90` | Global application navigation is outside this local browser. | Reject. |
| `AR-HCB-91` | Flat peer discovery requires a catalog. | Reject. |
| `AR-HCB-92` | Many-to-many relationships require a graph. | Reject. |

### Selection rule

Select `hierarchical-content-browser` only when AR-HCB-01, AR-HCB-02, AR-HCB-03 are evidenced and none of AR-HCB-90, AR-HCB-91, AR-HCB-92 applies. Apply the responsive contract when AR-HCB-04 occurs. Return `needs-evidence` when AR-HCB-05 cannot be proven.

## Region graph

```text
content-browser
├─ hierarchy-navigation
├─ current-path
├─ node-content-index
└─ optional-context-preview
```

Canonical relationship: `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `content-browser` | Owns taxonomy navigation and the current node's peer content index; establishes expanded branches, current path, selected node, content selection, and return anchor for every child without absorbing child responsibilities. |
| `hierarchy-navigation` | owns expansion, collapse, and node selection in the taxonomy; consumes expanded branches, current path, selected node, content selection, and return anchor from `content-browser` and publishes the same identity to `current-path`. |
| `current-path` | owns the visible ancestor path and compact Back route; consumes expanded branches, current path, selected node, content selection, and return anchor from `hierarchy-navigation` and publishes the same identity to `node-content-index`. |
| `node-content-index` | owns peer content belonging to the current node; consumes expanded branches, current path, selected node, content selection, and return anchor from `current-path` and publishes the same identity to `optional-context-preview`. |
| `optional-context-preview` | owns optional context for one selected item without becoming a required third hierarchy level; consumes expanded branches, current path, selected node, content selection, and return anchor from `node-content-index` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep hierarchy navigation beside the current node index; preview is optional and never a mandatory third semantic level.
- **Navigation replacement:** No replacement; hierarchy navigation and current node index remain simultaneous.
- **Sticky boundary:** The hierarchy may persist only when it reserves space and never obscures index focus.
- **Overflow owner:** Page flow owns the index; a large tree may own bounded internal vertical overflow.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Move the hierarchy into a collapsible rail or drawer while the current path remains visible.
- **Navigation replacement:** Move the hierarchy into a collapsible rail or drawer and keep current path always visible.
- **Sticky boundary:** The drawer returns focus to the path trigger.
- **Overflow owner:** Page flow owns the index; the drawer owns only its internal tree.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Drill down one level at a time with breadcrumb or Back, followed by the current node index.
- **Navigation replacement:** Use level-by-level drill-down with breadcrumb or Back, followed by the current node index.
- **Sticky boundary:** No desktop tree is forced into a permanent overlay.
- **Overflow owner:** The active level and index share page flow; inactive levels create no scroll.

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
| Initial/loading | `hierarchy-navigation` | Load node expansion and current index loading without replacing the last committed expanded branches, current path, selected node, content selection, and return anchor. | Retain the last safe context in every band. |
| Ready | `node-content-index` | Expose expanded path, current node, and peer index as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `current-path` | Represent empty current node with sibling or parent recovery; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `node-content-index` | When missing branch or node load failure with ancestor path retained, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `node-content-index` | Represent permission-limited branch without implying it is empty; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `optional-context-preview` | While expand, deep-link resolution, or preview load, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `optional-context-preview` | After selected node and index restore at the same path, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `node-content-index` | When external rename or move makes the path stale, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `hierarchy-navigation` | drawer close and compact Back restore expansion, selection, and trigger focus. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `content-browser` | Resize preserves expanded branches, current path, selected node, content selection, and return anchor, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Traverse a taxonomy or folder tree and inspect the content index owned by the current node.
- Every required region and the relationship `content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Global application navigation is outside this local browser.
- Flat peer discovery requires a catalog.
- Many-to-many relationships require a graph.
- Three independent levels require the three-pane explorer.
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
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Atlassian Design System — Components](https://atlassian.design/components/) | navigation, disclosure, and selection behavior | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [GitLab Pajamas — Patterns](https://design.gitlab.com/patterns/) | search, navigation, and result-state patterns | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA APG — Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | hierarchy semantics, selection, and keyboard movement | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: hierarchical-content-browser
situationCodes: AR-HCB-01, AR-HCB-02, AR-HCB-03, AR-HCB-04, AR-HCB-05
searchAliases: taxonomy browser, folder browser, content tree, hierarchical index
dominantTask: Traverse a taxonomy or folder tree and inspect the content index owned by the current node.
regions: content-browser, hierarchy-navigation, current-path, node-content-index, optional-context-preview
regionRelationships: content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview
responsive:
  wide: Keep hierarchy navigation beside the current node index; preview is optional and never a mandatory third semantic level.
  intermediate: Move the hierarchy into a collapsible rail or drawer while the current path remains visible.
  compact: Drill down one level at a time with breadcrumb or Back, followed by the current node index.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: content-browser → hierarchy-navigation → current-path → node-content-index → optional-context-preview
  navigationReplacement: Use level-by-level drill-down with breadcrumb or Back, followed by the current node index.
  stickyBehavior: No desktop tree is forced into a permanent overlay.
  overflowOwner: The active level and index share page flow; inactive levels create no scroll.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
