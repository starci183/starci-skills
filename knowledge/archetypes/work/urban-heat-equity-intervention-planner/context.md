# Urban Heat Equity Intervention Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `urban-heat-equity-intervention-planner` |
| Family | Work |
| Dominant task | Commit urban cooling interventions only where heat exposure, population vulnerability and cooling-access deficit jointly identify need, then prove distributional before/after outcomes for affected groups and bind each selected intervention to an accountable delivery and maintenance owner. |
| Search aliases | `urban`, `equity`, `intervention`, `planner` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Commit urban cooling interventions only where heat exposure, population vulnerability and cooling-access deficit jointly identify need, then prove distributional before/after outcomes for affected groups and bind each selected intervention to an accountable delivery and maintenance owner.
- The required region graph remains `heat-equity-planner → planning-area-season-policy-goals-and-population-groups → heat-exposure-measure-by-area ↔ vulnerability-measure-by-group ↔ cooling-and-essential-destination-access-catchments → exposure-times-vulnerability-times-access-deficit-joint-need-set → candidate-site-and-intervention-options → group-and-area-distributional-before-after-outcome-matrix → co-benefit-displacement-and-harm-checks → budget-delivery-owner-and-maintenance-commitments → selected-equitable-program-and-monitoring`.
- The mandatory relationship remains: no single layer may create priority, and aggregate gain cannot hide a worse outcome for a named group.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must derive one priority from all three exposure, vulnerability and access owners, compare two sites, show accessible distributional before/after results for at least two groups, reject an option whose aggregate gain worsens one priority group and bind funding, delivery owner and maintenance owner to the selected program.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-18-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-18-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-18-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-18-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-18-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-18-90` | The dominant task is actually `map-led-situation-monitor`. | Reject. |
| `AR-B13-18-91` | The dominant task is actually `capacity-allocation-overview`. | Reject. |
| `AR-B13-18-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `urban-heat-equity-intervention-planner` only when `AR-B13-18-01` through `AR-B13-18-05` are evidenced and none of `AR-B13-18-90` through `AR-B13-18-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
heat-equity-planner
└─ planning-area-season-policy-goals-and-population-groups
   └─ heat-exposure-measure-by-area
      ↔─ vulnerability-measure-by-group
         ↔─ cooling-and-essential-destination-access-catchments
            └─ exposure-times-vulnerability-times-access-deficit-joint-need-set
               └─ candidate-site-and-intervention-options
                  └─ group-and-area-distributional-before-after-outcome-matrix
                     └─ co-benefit-displacement-and-harm-checks
                        └─ budget-delivery-owner-and-maintenance-commitments
                           └─ selected-equitable-program-and-monitoring
```

- Required relationship: no single layer may create priority, and aggregate gain cannot hide a worse outcome for a named group.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `heat-equity-planner` | Owns evidence, state, and action for heat equity planner without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `planning-area-season-policy-goals-and-population-groups` | Owns evidence, state, and action for planning area season policy goals and population groups without borrowing product semantics. | Follows `heat-equity-planner` in semantic order and receives its verified context. |
| `heat-exposure-measure-by-area` | Owns evidence, state, and action for heat exposure measure by area without borrowing product semantics. | Follows `planning-area-season-policy-goals-and-population-groups` in semantic order and receives its verified context. |
| `vulnerability-measure-by-group` | Owns evidence, state, and action for vulnerability measure by group without borrowing product semantics. | Synchronizes bidirectionally with `heat-exposure-measure-by-area` in the same selection context. |
| `cooling-and-essential-destination-access-catchments` | Owns evidence, state, and action for cooling and essential destination access catchments without borrowing product semantics. | Synchronizes bidirectionally with `vulnerability-measure-by-group` in the same selection context. |
| `exposure-times-vulnerability-times-access-deficit-joint-need-set` | Owns evidence, state, and action for exposure times vulnerability times access deficit joint need set without borrowing product semantics. | Follows `cooling-and-essential-destination-access-catchments` in semantic order and receives its verified context. |
| `candidate-site-and-intervention-options` | Owns evidence, state, and action for candidate site and intervention options without borrowing product semantics. | Follows `exposure-times-vulnerability-times-access-deficit-joint-need-set` in semantic order and receives its verified context. |
| `group-and-area-distributional-before-after-outcome-matrix` | Owns evidence, state, and action for group and area distributional before after outcome matrix without borrowing product semantics. | Follows `candidate-site-and-intervention-options` in semantic order and receives its verified context. |
| `co-benefit-displacement-and-harm-checks` | Owns evidence, state, and action for co benefit displacement and harm checks without borrowing product semantics. | Follows `group-and-area-distributional-before-after-outcome-matrix` in semantic order and receives its verified context. |
| `budget-delivery-owner-and-maintenance-commitments` | Owns evidence, state, and action for budget delivery owner and maintenance commitments without borrowing product semantics. | Follows `co-benefit-displacement-and-harm-checks` in semantic order and receives its verified context. |
| `selected-equitable-program-and-monitoring` | Owns evidence, state, and action for selected equitable program and monitoring without borrowing product semantics. | Follows `budget-delivery-owner-and-maintenance-commitments` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Exposure, vulnerability and access owners, joint-need set, site options, distributional before/after matrix and owner commitments remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The selected community/group and candidate site remain primary; all three joint-need inputs and its distributional delta stay synchronized while other layers and program history move to routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Community/group → exposure evidence → vulnerability evidence → access deficit → joint-need verdict → site/intervention → distributional before/after across named groups → harm check → delivery/maintenance owner → select; maps transform into area/group and destination routes rather than stacked layers.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `heat-equity-planner → planning-area-season-policy-goals-and-population-groups → heat-exposure-measure-by-area ↔ vulnerability-measure-by-group ↔ cooling-and-essential-destination-access-catchments → exposure-times-vulnerability-times-access-deficit-joint-need-set → candidate-site-and-intervention-options → group-and-area-distributional-before-after-outcome-matrix → co-benefit-displacement-and-harm-checks → budget-delivery-owner-and-maintenance-commitments → selected-equitable-program-and-monitoring`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must derive one priority from all three exposure, vulnerability and access owners, compare two sites, show accessible distributional before/after results for at least two groups, reject an option whose aggregate gain worsens one priority group and bind funding, delivery owner and maintenance owner to the selected program.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `planning-area-season-policy-goals-and-population-groups` | Identify the pending owner and preserve its semantic position. |
| Ready | `heat-exposure-measure-by-area` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `vulnerability-measure-by-group` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `cooling-and-essential-destination-access-catchments` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `exposure-times-vulnerability-times-access-deficit-joint-need-set` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `budget-delivery-owner-and-maintenance-commitments` | Prevent duplicate action and announce progress without moving focus. |
| Success | `selected-equitable-program-and-monitoring` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `planning-area-season-policy-goals-and-population-groups` | Keep the last safe value and require explicit recovery. |
| Focus transition | `selected-equitable-program-and-monitoring` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `heat-equity-planner` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: exposure current/stale/missing, vulnerability measure approved/disputed, access catchment calculated/invalid, joint need incomplete/provisional/confirmed, site available/constrained, intervention estimated/designed/unfunded, group outcome improved/unchanged/worsened, aggregate gain sufficient/insufficient, displacement risk unknown/mitigated, delivery owner unassigned/committed, maintenance unfunded/secured and program draft/adopted/monitored.

## Boundaries

### Accept

- Accept when the dominant task is: Commit urban cooling interventions only where heat exposure, population vulnerability and cooling-access deficit jointly identify need, then prove distributional before/after outcomes for affected groups and bind each selected intervention to an accountable delivery and maintenance owner.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `map-led-situation-monitor`, `capacity-allocation-overview`, constrained quota, risk-impact-likelihood overview or portfolio health; exposure×vulnerability×access joint need, site-level interventions, distributional before/after proof and named delivery/maintenance ownership are mandatory.
- Reject a candidate whose only difference is product noun, count, density, color, component, or state as `duplicate-or-variation`.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, mandatory owner relationship, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface. The sources are current official pages verified during this batch.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [ArcGIS mapping application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA Heat Island Effect](https://www.epa.gov/heatislands) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA green infrastructure for heat reduction](https://www.epa.gov/green-infrastructure/reduce-heat-islands) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [CDC Heat & Health Tracker](https://ephtracking.cdc.gov/Applications/heatTracker/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NOAA/NESDIS — Mapping Heat Islands in Cities](https://www.nesdis.noaa.gov/events/nedtalk-extreme-heat-mapping-heat-islands-cities) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "urban-heat-equity-intervention-planner",
  "situationCodes": [
    "<matched AR-B13-18-* codes>"
  ],
  "searchAliases": [
    "urban",
    "equity",
    "intervention",
    "planner"
  ],
  "dominantTask": "Commit urban cooling interventions only where heat exposure, population vulnerability and cooling-access deficit jointly identify need, then prove distributional before/after outcomes for affected groups and bind each selected intervention to an accountable delivery and maintenance owner.",
  "regions": [
    "heat-equity-planner",
    "planning-area-season-policy-goals-and-population-groups",
    "heat-exposure-measure-by-area",
    "vulnerability-measure-by-group",
    "cooling-and-essential-destination-access-catchments",
    "exposure-times-vulnerability-times-access-deficit-joint-need-set",
    "candidate-site-and-intervention-options",
    "group-and-area-distributional-before-after-outcome-matrix",
    "co-benefit-displacement-and-harm-checks",
    "budget-delivery-owner-and-maintenance-commitments",
    "selected-equitable-program-and-monitoring"
  ],
  "relationships": [
    "no single layer may create priority, and aggregate gain cannot hide a worse outcome for a named group."
  ],
  "responsive": {
    "wide": "Exposure, vulnerability and access owners, joint-need set, site options, distributional before/after matrix and owner commitments remain simultaneously visible.",
    "intermediate": "The selected community/group and candidate site remain primary; all three joint-need inputs and its distributional delta stay synchronized while other layers and program history move to routes.",
    "compact": "Community/group → exposure evidence → vulnerability evidence → access deficit → joint-need verdict → site/intervention → distributional before/after across named groups → harm check → delivery/maintenance owner → select; maps transform into area/group and destination routes rather than stacked layers.",
    "reflow": [
      "heat-equity-planner",
      "planning-area-season-policy-goals-and-population-groups",
      "heat-exposure-measure-by-area",
      "vulnerability-measure-by-group",
      "cooling-and-essential-destination-access-catchments",
      "exposure-times-vulnerability-times-access-deficit-joint-need-set",
      "candidate-site-and-intervention-options",
      "group-and-area-distributional-before-after-outcome-matrix",
      "co-benefit-displacement-and-harm-checks",
      "budget-delivery-owner-and-maintenance-commitments",
      "selected-equitable-program-and-monitoring"
    ]
  },
  "stateObligations": "exposure current/stale/missing, vulnerability measure approved/disputed, access catchment calculated/invalid, joint need incomplete/provisional/confirmed, site available/constrained, intervention estimated/designed/unfunded, group outcome improved/unchanged/worsened, aggregate gain sufficient/insufficient, displacement risk unknown/mitigated, delivery owner unassigned/committed, maintenance unfunded/secured and program draft/adopted/monitored.",
  "boundaryVerdict": "accept | reject | needs-evidence | duplicate-or-variation",
  "grammarHandoff": "Bind product-specific owners, labels, permissions, actions, and truthful states.",
  "principlesHandoff": "Resolve exact geometry, measure, spacing, alignment, overflow, and relationship-driven transitions.",
  "confidence": "high | medium | low",
  "evidenceClasses": [
    "dominant-task",
    "region-graph",
    "responsive-parity",
    "state-family",
    "boundary",
    "official-research"
  ]
}
```
