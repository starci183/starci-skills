# Scoped federated search

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `scoped-federated-search` |
| Family | Discovery |
| Dominant task | Find one object across multiple content types or workspaces while preserving scope and result ownership. |
| Search aliases | `federated search, global search, type scoped search, workspace search` |
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
| `AR-SFS-01` | Find one object across multiple content types or workspaces while preserving scope and result ownership. | Candidate when evidenced. |
| `AR-SFS-02` | Every region in `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination` is required and has a distinct owner. | Required for selection. |
| `AR-SFS-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-SFS-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-SFS-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-SFS-90` | A homogeneous dataset requires faceted ranked results. | Reject. |
| `AR-SFS-91` | Taxonomy browsing requires a hierarchical content browser. | Reject. |
| `AR-SFS-92` | Search cannot replace the whole information architecture. | Reject. |

### Selection rule

Select `scoped-federated-search` only when AR-SFS-01, AR-SFS-02, AR-SFS-03 are evidenced and none of AR-SFS-90, AR-SFS-91, AR-SFS-92 applies. Apply the responsive contract when AR-SFS-04 occurs. Return `needs-evidence` when AR-SFS-05 cannot be proven.

## Region graph

```text
federated-search
├─ prominent-query
├─ scope-picker
├─ type-summary-navigation
├─ grouped-or-scoped-results
└─ result-pagination
```

Canonical relationship: `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `federated-search` | Owns the cross-type search session and explicit result ownership by scope and type; establishes query, selected scope, active type, per-type totals, and page for every child without absorbing child responsibilities. |
| `prominent-query` | owns the federated search session and partial-success contract; consumes query, selected scope, active type, per-type totals, and page from `federated-search` and publishes the same identity to `scope-picker`. |
| `scope-picker` | owns query editing and submission across object types; consumes query, selected scope, active type, per-type totals, and page from `prominent-query` and publishes the same identity to `type-summary-navigation`. |
| `type-summary-navigation` | owns workspace or repository scope and makes it visible with every result set; consumes query, selected scope, active type, per-type totals, and page from `scope-picker` and publishes the same identity to `grouped-or-scoped-results`. |
| `grouped-or-scoped-results` | owns all-types summary, type counts, and active-type navigation; consumes query, selected scope, active type, per-type totals, and page from `type-summary-navigation` and publishes the same identity to `result-pagination`. |
| `result-pagination` | owns results grouped by declared type or the current scoped type; consumes query, selected scope, active type, per-type totals, and page from `grouped-or-scoped-results` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Keep query and scope stable while type summary and the active result region remain simultaneously legible.
- **Navigation replacement:** No replacement; query, scope, type summary, and active results remain visible.
- **Sticky boundary:** Query and scope may persist only while they reserve space and do not obscure result focus.
- **Overflow owner:** Page flow owns results; type navigation has no independent page scroll.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Allow scope to wrap and replace type navigation with bounded overflow or a selector before labels become ambiguous.
- **Navigation replacement:** Wrap the scope control and use a bounded type strip or labeled select when type labels fail.
- **Sticky boundary:** Type navigation never overlays the committed query or scope.
- **Overflow owner:** Only the type strip may own bounded horizontal overflow; results remain in page flow.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Show one active type at a time with a route back to the all-types summary while query, scope, and page remain unchanged.
- **Navigation replacement:** Show one active type and open all-types summary through a selector or Back route that preserves query, scope, and page.
- **Sticky boundary:** No federated search surface is sticky at short height.
- **Overflow owner:** Page flow owns the active result type; the selector owns only its temporary list.

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
| Initial/loading | `prominent-query` | Load all-scope query with independent per-type loading without replacing the last committed query, selected scope, active type, per-type totals, and page. | Retain the last safe context in every band. |
| Ready | `grouped-or-scoped-results` | Expose active scope, active type, totals, and owned results as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `scope-picker` | Represent an empty type while other types may still succeed; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `grouped-or-scoped-results` | When partial failure isolated to one type or scope, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `grouped-or-scoped-results` | Represent permission-redacted group named without exposing hidden objects; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `result-pagination` | While query correction, type retry, or pagination, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `result-pagination` | After announced total for the committed scope and type, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `grouped-or-scoped-results` | When type totals changed while query and scope stayed constant, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `prominent-query` | compact type selector returns focus and preserves query, scope, and page. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `federated-search` | Resize preserves query, selected scope, active type, per-type totals, and page, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Find one object across multiple content types or workspaces while preserving scope and result ownership.
- Every required region and the relationship `federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- A homogeneous dataset requires faceted ranked results.
- Taxonomy browsing requires a hierarchical content browser.
- Search cannot replace the whole information architecture.
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
| [GitHub Docs — About searching on GitHub](https://docs.github.com/en/search-github/getting-started-with-searching-on-github/about-searching-on-github) | search scopes and heterogeneous object ownership | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Adobe Spectrum — Components](https://spectrum.adobe.com/page/components/) | component interaction evidence across media and controls | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | reflow without two-dimensional page scrolling | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [Microsoft Fluent 2 layout](https://fluent2.microsoft.design/layout) | adaptive region hierarchy and reflow | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: scoped-federated-search
situationCodes: AR-SFS-01, AR-SFS-02, AR-SFS-03, AR-SFS-04, AR-SFS-05
searchAliases: federated search, global search, type scoped search, workspace search
dominantTask: Find one object across multiple content types or workspaces while preserving scope and result ownership.
regions: federated-search, prominent-query, scope-picker, type-summary-navigation, grouped-or-scoped-results, result-pagination
regionRelationships: federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination
responsive:
  wide: Keep query and scope stable while type summary and the active result region remain simultaneously legible.
  intermediate: Allow scope to wrap and replace type navigation with bounded overflow or a selector before labels become ambiguous.
  compact: Show one active type at a time with a route back to the all-types summary while query, scope, and page remain unchanged.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: federated-search → prominent-query → scope-picker → type-summary-navigation → grouped-or-scoped-results → result-pagination
  navigationReplacement: Show one active type and open all-types summary through a selector or Back route that preserves query, scope, and page.
  stickyBehavior: No federated search surface is sticky at short height.
  overflowOwner: Page flow owns the active result type; the selector owns only its temporary list.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
