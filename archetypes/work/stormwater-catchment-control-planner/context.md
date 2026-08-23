# Stormwater Catchment Control Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `stormwater-catchment-control-planner` |
| Family | Work |
| Dominant task | Place and size distributed stormwater controls, reroute each intervention through its exact downstream drainage path and prove before/after hydrographs at every named affected node and outfall under selected design storms. |
| Search aliases | `stormwater`, `catchment`, `control`, `planner` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Place and size distributed stormwater controls, reroute each intervention through its exact downstream drainage path and prove before/after hydrographs at every named affected node and outfall under selected design storms.
- The required region graph remains `catchment-control-planner → study-area-and-design-storm → subcatchment-runoff-source-set ↔ directed-drainage-conveyance-topology → failing-node-and-outfall-hydrograph-register → candidate-control-site-type-and-parameters → intervention-to-named-downstream-node-path → rerouted-node-by-node-flow-and-pollutant-hydrographs → portfolio-capacity-quality-and-site-constraint-verdict → selected-plan-and-model-export`.
- The mandatory relationship remains: each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must select a surcharged named node, trace contributing subcatchments, place one control, show its rerouted path through at least two downstream nodes to a named outfall, compare each hydrograph's peak/volume/pollutant delta and reject a portfolio that merely moves the violation downstream.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-09-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-09-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-09-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-09-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-09-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-09-90` | The dominant task is actually `geospatial-raster-layer-analysis-workbench`. | Reject. |
| `AR-B13-09-91` | The dominant task is actually `map-led-situation-monitor`. | Reject. |
| `AR-B13-09-92` | The dominant task is actually `scenario-sensitivity-modeler`. | Reject. |
| `AR-B13-09-93` | The dominant task is actually `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-09-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `stormwater-catchment-control-planner` only when `AR-B13-09-01` through `AR-B13-09-05` are evidenced and none of `AR-B13-09-90` through `AR-B13-09-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
catchment-control-planner
└─ study-area-and-design-storm
   └─ subcatchment-runoff-source-set
      ↔─ directed-drainage-conveyance-topology
         └─ failing-node-and-outfall-hydrograph-register
            └─ candidate-control-site-type-and-parameters
               └─ intervention-to-named-downstream-node-path
                  └─ rerouted-node-by-node-flow-and-pollutant-hydrographs
                     └─ portfolio-capacity-quality-and-site-constraint-verdict
                        └─ selected-plan-and-model-export
```

- Required relationship: each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `catchment-control-planner` | Owns evidence, state, and action for catchment control planner without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `study-area-and-design-storm` | Owns evidence, state, and action for study area and design storm without borrowing product semantics. | Follows `catchment-control-planner` in semantic order and receives its verified context. |
| `subcatchment-runoff-source-set` | Owns evidence, state, and action for subcatchment runoff source set without borrowing product semantics. | Follows `study-area-and-design-storm` in semantic order and receives its verified context. |
| `directed-drainage-conveyance-topology` | Owns evidence, state, and action for directed drainage conveyance topology without borrowing product semantics. | Synchronizes bidirectionally with `subcatchment-runoff-source-set` in the same selection context. |
| `failing-node-and-outfall-hydrograph-register` | Owns evidence, state, and action for failing node and outfall hydrograph register without borrowing product semantics. | Follows `directed-drainage-conveyance-topology` in semantic order and receives its verified context. |
| `candidate-control-site-type-and-parameters` | Owns evidence, state, and action for candidate control site type and parameters without borrowing product semantics. | Follows `failing-node-and-outfall-hydrograph-register` in semantic order and receives its verified context. |
| `intervention-to-named-downstream-node-path` | Owns evidence, state, and action for intervention to named downstream node path without borrowing product semantics. | Follows `candidate-control-site-type-and-parameters` in semantic order and receives its verified context. |
| `rerouted-node-by-node-flow-and-pollutant-hydrographs` | Owns evidence, state, and action for rerouted node by node flow and pollutant hydrographs without borrowing product semantics. | Follows `intervention-to-named-downstream-node-path` in semantic order and receives its verified context. |
| `portfolio-capacity-quality-and-site-constraint-verdict` | Owns evidence, state, and action for portfolio capacity quality and site constraint verdict without borrowing product semantics. | Follows `rerouted-node-by-node-flow-and-pollutant-hydrographs` in semantic order and receives its verified context. |
| `selected-plan-and-model-export` | Owns evidence, state, and action for selected plan and model export without borrowing product semantics. | Follows `portfolio-capacity-quality-and-site-constraint-verdict` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Catchment topology, selected intervention route, named downstream hydrographs, portfolio controls and before/after verdict remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The selected control and its named downstream node path remain primary; other catchments, alternate interventions and unrelated hydrographs move to synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Design storm → failing named node/outfall → contributing subcatchments → feasible intervention → exact downstream node sequence → before/after hydrograph at each affected receptor → portfolio verdict; the map transforms into a topological route whose nodes open their paired hydrographs.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `catchment-control-planner → study-area-and-design-storm → subcatchment-runoff-source-set ↔ directed-drainage-conveyance-topology → failing-node-and-outfall-hydrograph-register → candidate-control-site-type-and-parameters → intervention-to-named-downstream-node-path → rerouted-node-by-node-flow-and-pollutant-hydrographs → portfolio-capacity-quality-and-site-constraint-verdict → selected-plan-and-model-export`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must select a surcharged named node, trace contributing subcatchments, place one control, show its rerouted path through at least two downstream nodes to a named outfall, compare each hydrograph's peak/volume/pollutant delta and reject a portfolio that merely moves the violation downstream.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `study-area-and-design-storm` | Identify the pending owner and preserve its semantic position. |
| Ready | `subcatchment-runoff-source-set` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `directed-drainage-conveyance-topology` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `failing-node-and-outfall-hydrograph-register` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `candidate-control-site-type-and-parameters` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `portfolio-capacity-quality-and-site-constraint-verdict` | Prevent duplicate action and announce progress without moving focus. |
| Success | `selected-plan-and-model-export` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `study-area-and-design-storm` | Keep the last safe value and require explicit recovery. |
| Focus transition | `selected-plan-and-model-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `catchment-control-planner` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: rainfall input missing/current/future-adjusted, model loading/nonconvergent, node normal/surcharged/flooding, downstream route complete/broken, hydrograph baseline/current/stale, outfall within/exceeding target, site feasible/constrained, control draft/undersized/valid, portfolio simulation queued/running, pollutant criterion unknown/pass/fail and plan selected/superseded.

## Boundaries

### Accept

- Accept when the dominant task is: Place and size distributed stormwater controls, reroute each intervention through its exact downstream drainage path and prove before/after hydrographs at every named affected node and outfall under selected design storms.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `geospatial-raster-layer-analysis-workbench`, `map-led-situation-monitor`, `scenario-sensitivity-modeler` or `process-mass-balance-analyzer`; rainfall-runoff routing, intervention-to-named-downstream-node topology and receptor-specific rerun hydrographs under named storms are mandatory.
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
| [WCAG Understanding Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EPA Storm Water Management Model](https://www.epa.gov/water-research/storm-water-management-model-swmm) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FEMA nature-based solutions guidance](https://www.fema.gov/emergency-managers/risk-management/climate-resilience/nature-based-solutions) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NOAA precipitation-frequency data server](https://hdsc.nws.noaa.gov/pfds/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "stormwater-catchment-control-planner",
  "situationCodes": [
    "<matched AR-B13-09-* codes>"
  ],
  "searchAliases": [
    "stormwater",
    "catchment",
    "control",
    "planner"
  ],
  "dominantTask": "Place and size distributed stormwater controls, reroute each intervention through its exact downstream drainage path and prove before/after hydrographs at every named affected node and outfall under selected design storms.",
  "regions": [
    "catchment-control-planner",
    "study-area-and-design-storm",
    "subcatchment-runoff-source-set",
    "directed-drainage-conveyance-topology",
    "failing-node-and-outfall-hydrograph-register",
    "candidate-control-site-type-and-parameters",
    "intervention-to-named-downstream-node-path",
    "rerouted-node-by-node-flow-and-pollutant-hydrographs",
    "portfolio-capacity-quality-and-site-constraint-verdict",
    "selected-plan-and-model-export"
  ],
  "relationships": [
    "each intervention owns a named downstream route, and its result is the propagated hydrograph change along that route rather than an aggregate catchment score."
  ],
  "responsive": {
    "wide": "Catchment topology, selected intervention route, named downstream hydrographs, portfolio controls and before/after verdict remain simultaneously visible.",
    "intermediate": "The selected control and its named downstream node path remain primary; other catchments, alternate interventions and unrelated hydrographs move to synchronized routes.",
    "compact": "Design storm → failing named node/outfall → contributing subcatchments → feasible intervention → exact downstream node sequence → before/after hydrograph at each affected receptor → portfolio verdict; the map transforms into a topological route whose nodes open their paired hydrographs.",
    "reflow": [
      "catchment-control-planner",
      "study-area-and-design-storm",
      "subcatchment-runoff-source-set",
      "directed-drainage-conveyance-topology",
      "failing-node-and-outfall-hydrograph-register",
      "candidate-control-site-type-and-parameters",
      "intervention-to-named-downstream-node-path",
      "rerouted-node-by-node-flow-and-pollutant-hydrographs",
      "portfolio-capacity-quality-and-site-constraint-verdict",
      "selected-plan-and-model-export"
    ]
  },
  "stateObligations": "rainfall input missing/current/future-adjusted, model loading/nonconvergent, node normal/surcharged/flooding, downstream route complete/broken, hydrograph baseline/current/stale, outfall within/exceeding target, site feasible/constrained, control draft/undersized/valid, portfolio simulation queued/running, pollutant criterion unknown/pass/fail and plan selected/superseded.",
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
