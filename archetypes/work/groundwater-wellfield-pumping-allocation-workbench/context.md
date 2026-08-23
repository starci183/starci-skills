# Groundwater Wellfield Pumping Allocation Workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `groundwater-wellfield-pumping-allocation-workbench` |
| Family | Work |
| Dominant task | Allocate pumping by well and period through a coupled-aquifer model whose delayed superposed responses attribute every named receptor impact to contributing well-time pairs and whose operating schedule changes when monitoring triggers fire. |
| Search aliases | `groundwater`, `wellfield`, `pumping`, `allocation`, `workbench` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Allocate pumping by well and period through a coupled-aquifer model whose delayed superposed responses attribute every named receptor impact to contributing well-time pairs and whose operating schedule changes when monitoring triggers fire.
- The required region graph remains `wellfield-allocation → model-version-horizon-recharge-and-boundary-condition-set → coupled-aquifer-layer-and-connection-topology → production-well-by-period-rate-schedule ↔ well-period-to-layer-response-kernels-and-time-lag → superposed-head-drawdown-and-interference-state → named-stream-spring-observation-subsidence-and-quality-receptor-series → receptor-threshold-violation-contribution-matrix-by-well-and-period → revised-schedule-and-coupled-model-rerun → receptor-specific-monitoring-trigger-and-amendment-rules → approved-operation-plan`.
- The mandatory relationship remains: feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must schedule at least three wells across multiple periods and two connected aquifers, expose a delayed superposed breach at one named receptor, attribute it by well×pumping period, adjust one earlier rate, rerun later receptor effects and activate a receptor-specific monitoring-triggered amendment without overwriting the approved baseline.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-20-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-20-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-20-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-20-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-20-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-20-90` | The dominant task is actually `constrained-quota-allocation-editor`. | Reject. |
| `AR-B13-20-91` | The dominant task is actually `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-20-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `groundwater-wellfield-pumping-allocation-workbench` only when `AR-B13-20-01` through `AR-B13-20-05` are evidenced and none of `AR-B13-20-90` through `AR-B13-20-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
wellfield-allocation
└─ model-version-horizon-recharge-and-boundary-condition-set
   └─ coupled-aquifer-layer-and-connection-topology
      └─ production-well-by-period-rate-schedule
         ↔─ well-period-to-layer-response-kernels-and-time-lag
            └─ superposed-head-drawdown-and-interference-state
               └─ named-stream-spring-observation-subsidence-and-quality-receptor-series
                  └─ receptor-threshold-violation-contribution-matrix-by-well-and-period
                     └─ revised-schedule-and-coupled-model-rerun
                        └─ receptor-specific-monitoring-trigger-and-amendment-rules
                           └─ approved-operation-plan
```

- Required relationship: feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `wellfield-allocation` | Owns evidence, state, and action for wellfield allocation without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `model-version-horizon-recharge-and-boundary-condition-set` | Owns evidence, state, and action for model version horizon recharge and boundary condition set without borrowing product semantics. | Follows `wellfield-allocation` in semantic order and receives its verified context. |
| `coupled-aquifer-layer-and-connection-topology` | Owns evidence, state, and action for coupled aquifer layer and connection topology without borrowing product semantics. | Follows `model-version-horizon-recharge-and-boundary-condition-set` in semantic order and receives its verified context. |
| `production-well-by-period-rate-schedule` | Owns evidence, state, and action for production well by period rate schedule without borrowing product semantics. | Follows `coupled-aquifer-layer-and-connection-topology` in semantic order and receives its verified context. |
| `well-period-to-layer-response-kernels-and-time-lag` | Owns evidence, state, and action for well period to layer response kernels and time lag without borrowing product semantics. | Synchronizes bidirectionally with `production-well-by-period-rate-schedule` in the same selection context. |
| `superposed-head-drawdown-and-interference-state` | Owns evidence, state, and action for superposed head drawdown and interference state without borrowing product semantics. | Follows `well-period-to-layer-response-kernels-and-time-lag` in semantic order and receives its verified context. |
| `named-stream-spring-observation-subsidence-and-quality-receptor-series` | Owns evidence, state, and action for named stream spring observation subsidence and quality receptor series without borrowing product semantics. | Follows `superposed-head-drawdown-and-interference-state` in semantic order and receives its verified context. |
| `receptor-threshold-violation-contribution-matrix-by-well-and-period` | Owns evidence, state, and action for receptor threshold violation contribution matrix by well and period without borrowing product semantics. | Follows `named-stream-spring-observation-subsidence-and-quality-receptor-series` in semantic order and receives its verified context. |
| `revised-schedule-and-coupled-model-rerun` | Owns evidence, state, and action for revised schedule and coupled model rerun without borrowing product semantics. | Follows `receptor-threshold-violation-contribution-matrix-by-well-and-period` in semantic order and receives its verified context. |
| `receptor-specific-monitoring-trigger-and-amendment-rules` | Owns evidence, state, and action for receptor specific monitoring trigger and amendment rules without borrowing product semantics. | Follows `revised-schedule-and-coupled-model-rerun` in semantic order and receives its verified context. |
| `approved-operation-plan` | Owns evidence, state, and action for approved operation plan without borrowing product semantics. | Follows `receptor-specific-monitoring-trigger-and-amendment-rules` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Coupled-aquifer topology, well-period schedule, superposed response, named receptor series, contribution matrix and trigger-bound revision remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The selected receptor breach and its contributing well-period paths remain primary; full aquifer context, other receptors and monitoring history move to synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Named receptor and threshold period → delayed contribution ranking by well×pumping period → coupled-aquifer path → rate/time adjustment → rerun receptor series → trigger/amendment rule → approve; maps transform into receptor-to-well causal paths with exact lagged values.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `wellfield-allocation → model-version-horizon-recharge-and-boundary-condition-set → coupled-aquifer-layer-and-connection-topology → production-well-by-period-rate-schedule ↔ well-period-to-layer-response-kernels-and-time-lag → superposed-head-drawdown-and-interference-state → named-stream-spring-observation-subsidence-and-quality-receptor-series → receptor-threshold-violation-contribution-matrix-by-well-and-period → revised-schedule-and-coupled-model-rerun → receptor-specific-monitoring-trigger-and-amendment-rules → approved-operation-plan`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must schedule at least three wells across multiple periods and two connected aquifers, expose a delayed superposed breach at one named receptor, attribute it by well×pumping period, adjust one earlier rate, rerun later receptor effects and activate a receptor-specific monitoring-triggered amendment without overwriting the approved baseline.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `model-version-horizon-recharge-and-boundary-condition-set` | Identify the pending owner and preserve its semantic position. |
| Ready | `coupled-aquifer-layer-and-connection-topology` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `production-well-by-period-rate-schedule` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `well-period-to-layer-response-kernels-and-time-lag` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `superposed-head-drawdown-and-interference-state` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `receptor-specific-monitoring-trigger-and-amendment-rules` | Prevent duplicate action and announce progress without moving focus. |
| Success | `approved-operation-plan` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `model-version-horizon-recharge-and-boundary-condition-set` | Keep the last safe value and require explicit recovery. |
| Focus transition | `approved-operation-plan` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `wellfield-allocation` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: model calibrated/provisional/stale, aquifer connection active/uncertain, recharge normal/drought/revised, observation missing/current/outlier, well available/limited/offline, schedule draft/running, response separate/interfering/delayed, receptor threshold safe/approaching/exceeded, attribution complete/ambiguous, solve nonconvergent/feasible, operation approved/amended and monitoring trigger normal/fired/acknowledged/closed.

## Boundaries

### Accept

- Accept when the dominant task is: Allocate pumping by well and period through a coupled-aquifer model whose delayed superposed responses attribute every named receptor impact to contributing well-time pairs and whose operating schedule changes when monitoring triggers fire.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `constrained-quota-allocation-editor`, `scenario-sensitivity-modeler`, calendar scheduler or raster analysis; coupled aquifers, time-varying well-period superposition, delayed named-receptor attribution and trigger-bound operating amendments are mandatory.
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
| [USGS MODFLOW 6](https://www.usgs.gov/software/modflow-6-usgs-modular-hydrologic-model) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [California DWR Groundwater Sustainability Plans](https://water.ca.gov/Programs/Groundwater-Management/SGMA-Groundwater-Management/Groundwater-Sustainability-Plans) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [California DWR best-management guidance](https://water.ca.gov/Programs/Groundwater-Management/SGMA-Groundwater-Management/Best-Management-Practices-and-Guidance-Documents) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA source-water protection](https://www.epa.gov/sourcewaterprotection/basic-information-about-source-water-protection) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "groundwater-wellfield-pumping-allocation-workbench",
  "situationCodes": [
    "<matched AR-B13-20-* codes>"
  ],
  "searchAliases": [
    "groundwater",
    "wellfield",
    "pumping",
    "allocation",
    "workbench"
  ],
  "dominantTask": "Allocate pumping by well and period through a coupled-aquifer model whose delayed superposed responses attribute every named receptor impact to contributing well-time pairs and whose operating schedule changes when monitoring triggers fire.",
  "regions": [
    "wellfield-allocation",
    "model-version-horizon-recharge-and-boundary-condition-set",
    "coupled-aquifer-layer-and-connection-topology",
    "production-well-by-period-rate-schedule",
    "well-period-to-layer-response-kernels-and-time-lag",
    "superposed-head-drawdown-and-interference-state",
    "named-stream-spring-observation-subsidence-and-quality-receptor-series",
    "receptor-threshold-violation-contribution-matrix-by-well-and-period",
    "revised-schedule-and-coupled-model-rerun",
    "receptor-specific-monitoring-trigger-and-amendment-rules",
    "approved-operation-plan"
  ],
  "relationships": [
    "feasibility derives from time-varying superposition through connected aquifers, and each receptor breach owns a contribution trace rather than a divisible pumping quota."
  ],
  "responsive": {
    "wide": "Coupled-aquifer topology, well-period schedule, superposed response, named receptor series, contribution matrix and trigger-bound revision remain simultaneously visible.",
    "intermediate": "The selected receptor breach and its contributing well-period paths remain primary; full aquifer context, other receptors and monitoring history move to synchronized routes.",
    "compact": "Named receptor and threshold period → delayed contribution ranking by well×pumping period → coupled-aquifer path → rate/time adjustment → rerun receptor series → trigger/amendment rule → approve; maps transform into receptor-to-well causal paths with exact lagged values.",
    "reflow": [
      "wellfield-allocation",
      "model-version-horizon-recharge-and-boundary-condition-set",
      "coupled-aquifer-layer-and-connection-topology",
      "production-well-by-period-rate-schedule",
      "well-period-to-layer-response-kernels-and-time-lag",
      "superposed-head-drawdown-and-interference-state",
      "named-stream-spring-observation-subsidence-and-quality-receptor-series",
      "receptor-threshold-violation-contribution-matrix-by-well-and-period",
      "revised-schedule-and-coupled-model-rerun",
      "receptor-specific-monitoring-trigger-and-amendment-rules",
      "approved-operation-plan"
    ]
  },
  "stateObligations": "model calibrated/provisional/stale, aquifer connection active/uncertain, recharge normal/drought/revised, observation missing/current/outlier, well available/limited/offline, schedule draft/running, response separate/interfering/delayed, receptor threshold safe/approaching/exceeded, attribution complete/ambiguous, solve nonconvergent/feasible, operation approved/amended and monitoring trigger normal/fired/acknowledged/closed.",
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
