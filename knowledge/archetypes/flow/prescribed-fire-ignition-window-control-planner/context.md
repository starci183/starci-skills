# Prescribed Fire Ignition Window Control Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `prescribed-fire-ignition-window-control-planner` |
| Family | Flow |
| Dominant task | Authorize and control staged ignition across one prescribed-fire unit by opening a time-bounded weather, fuel-moisture and smoke prescription window, advancing only eligible ignition blocks with adequate holding coverage and stopping before conditions or resources leave that window. |
| Search aliases | `prescribed`, `ignition`, `window`, `control`, `planner` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Authorize and control staged ignition across one prescribed-fire unit by opening a time-bounded weather, fuel-moisture and smoke prescription window, advancing only eligible ignition blocks with adequate holding coverage and stopping before conditions or resources leave that window.
- The required region graph remains `prescribed-fire-control → approved-burn-unit-plan-objectives-and-authority → control-line-and-ignition-block-adjacency-topology ↔ time-indexed-weather-fuel-moisture-and-smoke-prescription-window → sensitive-receptor-and-dispersion-constraint-set → holding-contingency-and-escape-resource-coverage → eligible-block-order-and-ignition-method → go-no-go-and-test-fire-gate → active-block-observation-and-window-consumption → continue-pause-mop-up-or-wildfire-conversion → post-burn-objective-smoke-and-action-record`.
- The mandatory relationship remains: spatial block eligibility and the remaining safe time window jointly own every ignition decision.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must open a fictional ignition window, block one ignition block for missing holding coverage, pass a documented test fire, consume the window as two adjacent blocks ignite, pause when a smoke or weather threshold is crossed and expose mop-up, contingency and wildfire-conversion recovery without losing the approved plan snapshot.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-05-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-05-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-05-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-05-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-05-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-05-90` | The dominant task is actually `stage-gated-process-record`. | Reject. |
| `AR-B13-05-91` | The dominant task is actually `permit-to-work-isolation-control-room`. | Reject. |
| `AR-B13-05-92` | The dominant task is actually `live-operations-command-center`. | Reject. |
| `AR-B13-05-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `prescribed-fire-ignition-window-control-planner` only when `AR-B13-05-01` through `AR-B13-05-05` are evidenced and none of `AR-B13-05-90` through `AR-B13-05-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
prescribed-fire-control
└─ approved-burn-unit-plan-objectives-and-authority
   └─ control-line-and-ignition-block-adjacency-topology
      ↔─ time-indexed-weather-fuel-moisture-and-smoke-prescription-window
         └─ sensitive-receptor-and-dispersion-constraint-set
            └─ holding-contingency-and-escape-resource-coverage
               └─ eligible-block-order-and-ignition-method
                  └─ go-no-go-and-test-fire-gate
                     └─ active-block-observation-and-window-consumption
                        └─ continue-pause-mop-up-or-wildfire-conversion
                           └─ post-burn-objective-smoke-and-action-record
```

- Required relationship: spatial block eligibility and the remaining safe time window jointly own every ignition decision.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `prescribed-fire-control` | Owns evidence, state, and action for prescribed fire control without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `approved-burn-unit-plan-objectives-and-authority` | Owns evidence, state, and action for approved burn unit plan objectives and authority without borrowing product semantics. | Follows `prescribed-fire-control` in semantic order and receives its verified context. |
| `control-line-and-ignition-block-adjacency-topology` | Owns evidence, state, and action for control line and ignition block adjacency topology without borrowing product semantics. | Follows `approved-burn-unit-plan-objectives-and-authority` in semantic order and receives its verified context. |
| `time-indexed-weather-fuel-moisture-and-smoke-prescription-window` | Owns evidence, state, and action for time indexed weather fuel moisture and smoke prescription window without borrowing product semantics. | Synchronizes bidirectionally with `control-line-and-ignition-block-adjacency-topology` in the same selection context. |
| `sensitive-receptor-and-dispersion-constraint-set` | Owns evidence, state, and action for sensitive receptor and dispersion constraint set without borrowing product semantics. | Follows `time-indexed-weather-fuel-moisture-and-smoke-prescription-window` in semantic order and receives its verified context. |
| `holding-contingency-and-escape-resource-coverage` | Owns evidence, state, and action for holding contingency and escape resource coverage without borrowing product semantics. | Follows `sensitive-receptor-and-dispersion-constraint-set` in semantic order and receives its verified context. |
| `eligible-block-order-and-ignition-method` | Owns evidence, state, and action for eligible block order and ignition method without borrowing product semantics. | Follows `holding-contingency-and-escape-resource-coverage` in semantic order and receives its verified context. |
| `go-no-go-and-test-fire-gate` | Owns evidence, state, and action for go no go and test fire gate without borrowing product semantics. | Follows `eligible-block-order-and-ignition-method` in semantic order and receives its verified context. |
| `active-block-observation-and-window-consumption` | Owns evidence, state, and action for active block observation and window consumption without borrowing product semantics. | Follows `go-no-go-and-test-fire-gate` in semantic order and receives its verified context. |
| `continue-pause-mop-up-or-wildfire-conversion` | Owns evidence, state, and action for continue pause mop up or wildfire conversion without borrowing product semantics. | Follows `active-block-observation-and-window-consumption` in semantic order and receives its verified context. |
| `post-burn-objective-smoke-and-action-record` | Owns evidence, state, and action for post burn objective smoke and action record without borrowing product semantics. | Follows `continue-pause-mop-up-or-wildfire-conversion` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Burn-unit topology, forecast/observed prescription window, smoke receptors, block order, resource coverage and current go/no-go gate remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The active block, its adjacent control lines, remaining window and holding coverage remain primary; other blocks, forecast members, receptor detail and the complete action record move to synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Burn day and authority → current prescription window → next eligible ignition block and adjacent control lines → smoke receptors and holding resources → go/no-go/test fire → ignite or pause → observed window consumption → next block, mop-up or conversion; the map transforms into an ordered block-adjacency spine with explicit escape and holding facts.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `prescribed-fire-control → approved-burn-unit-plan-objectives-and-authority → control-line-and-ignition-block-adjacency-topology ↔ time-indexed-weather-fuel-moisture-and-smoke-prescription-window → sensitive-receptor-and-dispersion-constraint-set → holding-contingency-and-escape-resource-coverage → eligible-block-order-and-ignition-method → go-no-go-and-test-fire-gate → active-block-observation-and-window-consumption → continue-pause-mop-up-or-wildfire-conversion → post-burn-objective-smoke-and-action-record`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must open a fictional ignition window, block one ignition block for missing holding coverage, pass a documented test fire, consume the window as two adjacent blocks ignite, pause when a smoke or weather threshold is crossed and expose mop-up, contingency and wildfire-conversion recovery without losing the approved plan snapshot.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `approved-burn-unit-plan-objectives-and-authority` | Identify the pending owner and preserve its semantic position. |
| Ready | `control-line-and-ignition-block-adjacency-topology` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `time-indexed-weather-fuel-moisture-and-smoke-prescription-window` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `sensitive-receptor-and-dispersion-constraint-set` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `holding-contingency-and-escape-resource-coverage` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `continue-pause-mop-up-or-wildfire-conversion` | Prevent duplicate action and announce progress without moving focus. |
| Success | `post-burn-objective-smoke-and-action-record` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `approved-burn-unit-plan-objectives-and-authority` | Keep the last safe value and require explicit recovery. |
| Focus transition | `post-burn-objective-smoke-and-action-record` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `prescribed-fire-control` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: plan draft/approved/expired, unit ready/not-ready, forecast missing/current/divergent, prescription window closed/open/narrowing/exceeded, fuel moisture within/outside range, smoke receptor clear/at-risk/impacted, resource unassigned/ready/diverted, block locked/eligible/igniting/complete, test fire pending/pass/fail, ignition continue/paused/terminated, contingency activated, wildfire conversion ordered and post-burn review open/complete.

## Boundaries

### Accept

- Accept when the dominant task is: Authorize and control staged ignition across one prescribed-fire unit by opening a time-bounded weather, fuel-moisture and smoke prescription window, advancing only eligible ignition blocks with adequate holding coverage and stopping before conditions or resources leave that window.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `stage-gated-process-record`, `permit-to-work-isolation-control-room`, `live-operations-command-center`, generic weather planning or incident dispatch; an approved burn-unit block topology, time-consuming prescription window, smoke receptors, block-specific holding/contingency coverage, test-fire gate and explicit pause-or-conversion path are mandatory.
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
| [WCAG Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NWCG Standards for Prescribed Fire Planning and Implementation](https://www.nwcg.gov/publications/pms484) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [National Weather Service Fire Weather](https://www.weather.gov/fire/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA prescribed-burning and air-quality guidance](https://www.epa.gov/agriculture/agriculture-and-air-quality) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "prescribed-fire-ignition-window-control-planner",
  "situationCodes": [
    "<matched AR-B13-05-* codes>"
  ],
  "searchAliases": [
    "prescribed",
    "ignition",
    "window",
    "control",
    "planner"
  ],
  "dominantTask": "Authorize and control staged ignition across one prescribed-fire unit by opening a time-bounded weather, fuel-moisture and smoke prescription window, advancing only eligible ignition blocks with adequate holding coverage and stopping before conditions or resources leave that window.",
  "regions": [
    "prescribed-fire-control",
    "approved-burn-unit-plan-objectives-and-authority",
    "control-line-and-ignition-block-adjacency-topology",
    "time-indexed-weather-fuel-moisture-and-smoke-prescription-window",
    "sensitive-receptor-and-dispersion-constraint-set",
    "holding-contingency-and-escape-resource-coverage",
    "eligible-block-order-and-ignition-method",
    "go-no-go-and-test-fire-gate",
    "active-block-observation-and-window-consumption",
    "continue-pause-mop-up-or-wildfire-conversion",
    "post-burn-objective-smoke-and-action-record"
  ],
  "relationships": [
    "spatial block eligibility and the remaining safe time window jointly own every ignition decision."
  ],
  "responsive": {
    "wide": "Burn-unit topology, forecast/observed prescription window, smoke receptors, block order, resource coverage and current go/no-go gate remain simultaneously visible.",
    "intermediate": "The active block, its adjacent control lines, remaining window and holding coverage remain primary; other blocks, forecast members, receptor detail and the complete action record move to synchronized routes.",
    "compact": "Burn day and authority → current prescription window → next eligible ignition block and adjacent control lines → smoke receptors and holding resources → go/no-go/test fire → ignite or pause → observed window consumption → next block, mop-up or conversion; the map transforms into an ordered block-adjacency spine with explicit escape and holding facts.",
    "reflow": [
      "prescribed-fire-control",
      "approved-burn-unit-plan-objectives-and-authority",
      "control-line-and-ignition-block-adjacency-topology",
      "time-indexed-weather-fuel-moisture-and-smoke-prescription-window",
      "sensitive-receptor-and-dispersion-constraint-set",
      "holding-contingency-and-escape-resource-coverage",
      "eligible-block-order-and-ignition-method",
      "go-no-go-and-test-fire-gate",
      "active-block-observation-and-window-consumption",
      "continue-pause-mop-up-or-wildfire-conversion",
      "post-burn-objective-smoke-and-action-record"
    ]
  },
  "stateObligations": "plan draft/approved/expired, unit ready/not-ready, forecast missing/current/divergent, prescription window closed/open/narrowing/exceeded, fuel moisture within/outside range, smoke receptor clear/at-risk/impacted, resource unassigned/ready/diverted, block locked/eligible/igniting/complete, test fire pending/pass/fail, ignition continue/paused/terminated, contingency activated, wildfire conversion ordered and post-burn review open/complete.",
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
