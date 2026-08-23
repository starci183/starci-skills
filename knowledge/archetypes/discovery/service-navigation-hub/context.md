# Service navigation hub

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `service-navigation-hub` |
| Family | Discovery |
| Dominant task | Choose the correct service or task branch from grouped information architecture even when search is unavailable. |
| Search aliases | `service hub, task directory, grouped services, citizen navigation` |
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
| `AR-SNH-01` | Choose the correct service or task branch from grouped information architecture even when search is unavailable. | Candidate when evidenced. |
| `AR-SNH-02` | Every region in `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation` is required and has a distinct owner. | Required for selection. |
| `AR-SNH-03` | Selection, query, anchor, progress, or path is shared state across related regions. | Preserve one state identity. |
| `AR-SNH-04` | A named simultaneous relationship fails before content or controls become unusable. | Apply the responsive contract. |
| `AR-SNH-05` | The compact replacement preserves actions, state, recovery, and focus context. | Required for parity. |
| `AR-SNH-90` | Filtered and sorted products require a catalog. | Reject. |
| `AR-SNH-91` | Global application navigation is a shell concern. | Reject. |
| `AR-SNH-92` | Marketing landing pages persuade rather than route. | Reject. |

### Selection rule

Select `service-navigation-hub` only when AR-SNH-01, AR-SNH-02, AR-SNH-03 are evidenced and none of AR-SNH-90, AR-SNH-91, AR-SNH-92 applies. Apply the responsive contract when AR-SNH-04 occurs. Return `needs-evidence` when AR-SNH-05 cannot be proven.

## Region graph

```text
service-hub
├─ context-and-search
├─ top-tasks
├─ grouped-navigation-sections
└─ status-or-contact-escalation
```

Canonical relationship: `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation`.

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `service-hub` | Owns intent-based routing through grouped services even when search is unavailable; establishes service context, query, group order, route availability, and escalation status for every child without absorbing child responsibilities. |
| `context-and-search` | owns optional search context and explains that grouped navigation remains authoritative; consumes service context, query, group order, route availability, and escalation status from `service-hub` and publishes the same identity to `top-tasks`. |
| `top-tasks` | owns the short highest-priority task set; consumes service context, query, group order, route availability, and escalation status from `context-and-search` and publishes the same identity to `grouped-navigation-sections`. |
| `grouped-navigation-sections` | owns complete intent-based route groups and one primary link per item; consumes service context, query, group order, route availability, and escalation status from `top-tasks` and publishes the same identity to `status-or-contact-escalation`. |
| `status-or-contact-escalation` | owns degraded-service notice, contact, and escalation routes; consumes service context, query, group order, route availability, and escalation status from `grouped-navigation-sections` and closes the dominant-task loop. |

## Responsive contract

### Wide

- **Failure trigger:** Every required region retains usable measure and simultaneity still helps the dominant task.
- **Topology response:** Use one short top-task row followed by two or three grouped columns in semantic priority.
- **Navigation replacement:** No replacement; a short top-task row precedes two or three semantic navigation groups.
- **Sticky boundary:** No service group is sticky; status may persist only with reserved space and a dismiss route.
- **Overflow owner:** Page flow owns every service group and escalation route.

### Intermediate

- **Failure trigger:** The lowest-priority supporting region can no longer coexist without harming measure, path, or controls.
- **Topology response:** Use two columns while preserving group order and route identity.
- **Navigation replacement:** Use two columns while preserving semantic group order and top-task priority.
- **Sticky boundary:** Search results never overlay or replace the grouped route authority.
- **Overflow owner:** Page flow remains the only scroll owner.

### Compact

- **Failure trigger:** Two or more primary and supporting regions cannot coexist with usable reading, focus, and touch targets.
- **Topology response:** Use one priority-ordered column of group headings and links without converting every route into a giant card or nested accordion.
- **Navigation replacement:** Use one priority-ordered column of group headings and links; do not turn every route into a card or nested accordion.
- **Sticky boundary:** No navigation group is sticky at short height.
- **Overflow owner:** Page flow owns the complete information architecture.

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
| Initial/loading | `context-and-search` | Load service context and optional search loading without replacing the last committed service context, query, group order, route availability, and escalation status. | Retain the last safe context in every band. |
| Ready | `grouped-navigation-sections` | Expose top tasks, grouped routes, and escalation availability as one committed shared state. | Represent the same identity in every topology. |
| Empty/not-applicable | `top-tasks` | Represent empty group or absent personalized recent task without removing core routes; distinguish empty from not-applicable and keep a recovery route. | Place explanation and recovery in the primary sequence. |
| Error/retry | `grouped-navigation-sections` | When search unavailable while grouped navigation remains fully usable, name the failing scope and preserve unaffected context. | Keep retry reachable outside any collapsed surface. |
| Permission/unavailable | `grouped-navigation-sections` | Represent service degraded or route unavailable with contact alternative; never imply that unavailable data is absent. | Keep the path and an alternate route visible. |
| Pending | `status-or-contact-escalation` | While search update or contact escalation, disable duplicate action and announce progress without moving focus. | Keep the action label, target, and recovery. |
| Success | `status-or-contact-escalation` | After search result or escalation status is announced without moving focus, confirm the outcome without resetting selection or scrolling automatically. | Announce the outcome in place. |
| Stale/conflict | `grouped-navigation-sections` | When service status changes while route groups remain stable, preserve the last safe view and offer refresh or reconciliation. | Topology change never resolves staleness implicitly. |
| Focus transition | `context-and-search` | search update preserves focus intentionally; fallback navigation never requires search. | Inline and modal presentations retain the same action path. |
| Responsive presentation | `service-hub` | Resize preserves service context, query, group order, route availability, and escalation status, recovery, and action availability. | No state or action disappears. |

## Boundaries

### Accept

- The dominant task matches: Choose the correct service or task branch from grouped information architecture even when search is unavailable.
- Every required region and the relationship `service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation` are evidenced.
- The compact replacement preserves selection, state, actions, recovery, and focus context.

### Reject

- Filtered and sorted products require a catalog.
- Global application navigation is a shell concern.
- Marketing landing pages persuade rather than route.
- A one-service start page owns one bounded path.
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
| [NHS Service Manual — Patterns](https://service-manual.nhs.uk/design-system/patterns) | service routing and escalation patterns | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [U.S. Web Design System — Patterns](https://designsystem.digital.gov/patterns/) | public-service task and recovery patterns | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [GOV.UK Design System — Patterns](https://design-system.service.gov.uk/patterns/) | task-oriented service navigation and form recovery | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | meaningful focus order | Does not prove product truth, exact geometry, component trees, or breakpoints. |
| [W3C WCAG 2.2 — Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | non-disruptive status announcements | Does not prove product truth, exact geometry, component trees, or breakpoints. |

## Output

```text
archetypeId: service-navigation-hub
situationCodes: AR-SNH-01, AR-SNH-02, AR-SNH-03, AR-SNH-04, AR-SNH-05
searchAliases: service hub, task directory, grouped services, citizen navigation
dominantTask: Choose the correct service or task branch from grouped information architecture even when search is unavailable.
regions: service-hub, context-and-search, top-tasks, grouped-navigation-sections, status-or-contact-escalation
regionRelationships: service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation
responsive:
  wide: Use one short top-task row followed by two or three grouped columns in semantic priority.
  intermediate: Use two columns while preserving group order and route identity.
  compact: Use one priority-ordered column of group headings and links without converting every route into a giant card or nested accordion.
  reflow: semantic and DOM order follow the declared region graph
  readingOrder: service-hub → context-and-search → top-tasks → grouped-navigation-sections → status-or-contact-escalation
  navigationReplacement: Use one priority-ordered column of group headings and links; do not turn every route into a card or nested accordion.
  stickyBehavior: No navigation group is sticky at short height.
  overflowOwner: Page flow owns the complete information architecture.
  interactionParity: every action, state, recovery route, and keyboard path survives
stateObligations: the families in the state matrix
boundaryVerdict: accept | reject | needs-evidence | duplicate-or-variation
grammarHandoff: assign product-semantic owners to required regions
principlesHandoff: resolve exact grid, measure, gap, size, alignment, overflow, and breakpoint
confidence: high — prompt contract and official multi-source evidence converge
evidenceClasses: prompt contract, official interaction guidance, official accessibility guidance
```
