# Faceted ranked results

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `faceted-ranked-results` |
| Family | Discovery |
| Dominant task | Express a known need, narrow one dataset, and judge relevance through ranked snippets. |
| Search aliases | `faceted search, ranked results, relevance snippets, filter results` |
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
| `AR-FRR-01` | Express a known need, narrow one dataset, and judge relevance through ranked snippets. | Candidate when evidenced. |
| `AR-FRR-02` | Every region in `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination` is required and has a distinct owner. | Required for selection. |
| `AR-FRR-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-FRR-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-FRR-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-FRR-90` | Browse-first peer cards require a catalog. | Reject. |
| `AR-FRR-91` | A simple known list does not require relevance ranking. | Reject. |
| `AR-FRR-92` | Heterogeneous global search requires federated scope. | Reject. |

### Selection rule

Select `faceted-ranked-results` only when AR-FRR-01, AR-FRR-02, AR-FRR-03 are evidenced and none of AR-FRR-90, AR-FRR-91, AR-FRR-92 applies. Apply the responsive contract when AR-FRR-04 occurs. Return `needs-evidence` when AR-FRR-05 cannot be proven.

## Region graph

```text
search-results
├─ query-and-scope
├─ facet-controls
├─ applied-filter-summary
├─ count-sort
├─ ranked-result-list
└─ pagination
```

Canonical relationship: `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `search-results` | Owns the known-need query, reversible narrowing, and relevance evaluation; establishes query, scope, applied facets, sort, result count, and page for every child without absorbing child responsibilities. |
| `query-and-scope` | owns the search session and committed result context; consumes query, scope, applied facets, sort, result count, and page from `search-results` and publishes the same identity to `facet-controls`. |
| `facet-controls` | owns query submission and the homogeneous search scope; consumes query, scope, applied facets, sort, result count, and page from `query-and-scope` and publishes the same identity to `applied-filter-summary`. |
| `applied-filter-summary` | owns draft facet choices and apply/reset behavior; consumes query, scope, applied facets, sort, result count, and page from `facet-controls` and publishes the same identity to `count-sort`. |
| `count-sort` | names committed constraints outside any temporary filter surface; consumes query, scope, applied facets, sort, result count, and page from `applied-filter-summary` and publishes the same identity to `ranked-result-list`. |
| `ranked-result-list` | owns result total and ordering without changing relevance evidence; consumes query, scope, applied facets, sort, result count, and page from `count-sort` and publishes the same identity to `pagination`. |
| `pagination` | owns ranked snippets as the primary evidence for result choice; consumes query, scope, applied facets, sort, result count, and page from `ranked-result-list` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep the facet rail beside ranked snippets while query, count, and result ownership remain visibly coupled.
- **Navigation replacement:** No replacement; facet controls and ranked results remain simultaneous.
- **Sticky boundary:** Query and result context may persist only when reserved space keeps focused results visible.
- **Overflow owner:** Page flow owns result reading; the facet rail owns no competing page scroll.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Move facets into a collapsible or temporary surface while applied criteria and result count remain outside.
- **Navigation replacement:** Replace the facet rail with a collapsible or temporary filter surface; keep applied filters and count outside.
- **Sticky boundary:** The temporary surface traps focus only while modal and returns to the filter trigger.
- **Overflow owner:** The filter surface may scroll internally; result reading stays in page flow.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Use one reading sequence for query, applied summary, filter trigger, sort, ranked snippets, and pagination; the filter sheet restores focus and query state.
- **Navigation replacement:** Use a filter sheet with explicit apply/reset and preserve query, sort, page, and trigger focus.
- **Sticky boundary:** Query context may be sticky only when it reserves space and yields at short height.
- **Overflow owner:** Page flow owns results; the open sheet owns only its bounded internal scroll.

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
| Initial/loading | `query-and-scope` | Load query submission with retained prior results without replacing the last committed query, scope, applied facets, sort, result count, and page. | Retain the last safe context in every band. |
| Ready | `ranked-result-list` | Expose ranked snippets, applied facets, count, and sort as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `facet-controls` | Represent zero results with spelling, facet, and query recovery; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `ranked-result-list` | When query or page failure with committed criteria retained, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `ranked-result-list` | Represent a stale or unavailable result without hiding the rest of the ranking; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `pagination` | While facet apply, reset, query submit, or pagination, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `pagination` | After announced result count after committed criteria change, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `ranked-result-list` | When result set changed after ranking was displayed, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `query-and-scope` | filter sheet close returns to the trigger and keeps query and page. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `search-results` | Resize preserves query, scope, applied facets, sort, result count, and page, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Express a known need, narrow one dataset, and judge relevance through ranked snippets.
- Every required region and the relationship `search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Browse-first peer cards require a catalog.
- A simple known list does not require relevance ranking.
- Heterogeneous global search requires federated scope.
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
| [IBM Carbon — Filtering](https://carbondesignsystem.com/patterns/filtering/) | reversible filters and applied criteria | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | keyboard and widget interaction models | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [GitLab Pajamas — Patterns](https://design.gitlab.com/patterns/) | search, navigation, and result-state patterns | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: faceted-ranked-results
situationCodes: AR-FRR-01, AR-FRR-02, AR-FRR-03, AR-FRR-04, AR-FRR-05
searchAliases: faceted search, ranked results, relevance snippets, filter results
dominantTask: Express a known need, narrow one dataset, and judge relevance through ranked snippets.
regions: search-results, query-and-scope, facet-controls, applied-filter-summary, count-sort, ranked-result-list, pagination
regionRelationships: search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination
responsive:
  wide: Keep the facet rail beside ranked snippets while query, count, and result ownership remain visibly coupled.
  intermediate: Move facets into a collapsible or temporary surface while applied criteria and result count remain outside.
  compact: Use one reading sequence for query, applied summary, filter trigger, sort, ranked snippets, and pagination; the filter sheet restores focus and query state.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: search-results → query-and-scope → facet-controls → applied-filter-summary → count-sort → ranked-result-list → pagination
  navigationReplacement: Use a filter sheet with explicit apply/reset and preserve query, sort, page, and trigger focus.
  stickyBehavior: Query context may be sticky only when it reserves space and yields at short height.
  overflowOwner: Page flow owns results; the open sheet owns only its bounded internal scroll.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
