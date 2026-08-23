# Geospatial raster-layer analysis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `geospatial-raster-layer-analysis-workbench` |
| Family | Work |
| Dominant task | Analyze co-registered raster bands or layers through cell values, algebra, distributions, and transect profiles. |
| Search aliases | `raster analysis`, `band algebra`, `cell query`, `transect profile` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Raster cells, the formula stack, and numeric distributions or profiles are peer owners under one registered coverage and selection.
- The required region graph remains `raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage → legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Cell or band algebra and numeric spatial profiles must dominate the task.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-GR-01` | The dominant task is: Analyze co-registered raster bands or layers through cell values, algebra, distributions, and transect profiles. | Candidate evidence. |
| `AR-GR-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-GR-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-GR-04` | Cell or band algebra and numeric spatial profiles must dominate the task. | Required relationship evidence. |
| `AR-GR-90` | The dominant task is place discovery map. | Reject. |
| `AR-GR-91` | The dominant task is live situation map. | Reject. |
| `AR-GR-92` | The dominant task is generic canvas. | Reject. |
| `AR-GR-93` | The dominant task is dashboard. | Reject. |

### Selection rule

Select `geospatial-raster-layer-analysis-workbench` only when `AR-GR-01`, `AR-GR-02`, `AR-GR-03`, and `AR-GR-04` are evidenced and none of the `AR-GR-90` through `AR-GR-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
raster-workbench
└─ coverage-and-time-context
   └─ layer-and-band-algebra-stack
      └─ raster-map-stage
         └─ legend-and-histogram
            └─ point-or-area-query
               └─ transect-profile
                  └─ derived-result-and-export
```

- Required relationship: Raster cells, the formula stack, and numeric distributions or profiles are peer owners under one registered coverage and selection.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `raster-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `coverage-and-time-context` | Owns the evidence, state, and action for coverage and time context without borrowing product semantics. | Follows `raster-workbench` in semantic order and retains the same selection context. |
| `layer-and-band-algebra-stack` | Owns the evidence, state, and action for layer and band algebra stack without borrowing product semantics. | Follows `coverage-and-time-context` in semantic order and retains the same selection context. |
| `raster-map-stage` | Owns the evidence, state, and action for raster map stage without borrowing product semantics. | Follows `layer-and-band-algebra-stack` in semantic order and retains the same selection context. |
| `legend-and-histogram` | Owns the evidence, state, and action for legend and histogram without borrowing product semantics. | Follows `raster-map-stage` in semantic order and retains the same selection context. |
| `point-or-area-query` | Owns the evidence, state, and action for point or area query without borrowing product semantics. | Follows `legend-and-histogram` in semantic order and retains the same selection context. |
| `transect-profile` | Owns the evidence, state, and action for transect profile without borrowing product semantics. | Follows `point-or-area-query` in semantic order and retains the same selection context. |
| `derived-result-and-export` | Owns the evidence, state, and action for derived result and export without borrowing product semantics. | Follows `transect-profile` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the layer stack, raster stage, and histogram or profile visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `raster-map-stage` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Move the layer stack to a drawer while the selected formula and queried value persist.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `raster-map-stage` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use layer list → full-screen map → selected-cell numeric table → transect or profile → result; the map is never the only data route.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `raster-map-stage` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage → legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, measurement, action, retry, and recovery path remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, shared coordinate or path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- A modal traps focus, supports Escape or Cancel, and returns focus to the exact trigger.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The fictional result retains numeric alternatives for every map-derived value.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `coverage-and-time-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `layer-and-band-algebra-stack` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `raster-map-stage` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `legend-and-histogram` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `point-or-area-query` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `derived-result-and-export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `derived-result-and-export` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `coverage-and-time-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `derived-result-and-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `raster-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: coverage loading, coverage no data, layer hidden, layer error, formula valid, formula invalid, formula calculating, cell selected, cell masked, transect draft, transect ready, histogram stale, result pending, result failure, export ready.

## Boundaries

### Accept

- Accept when analyze co-registered raster bands or layers through cell values, algebra, distributions, and transect profiles.
- Accept when raster cells, the formula stack, and numeric distributions or profiles are peer owners under one registered coverage and selection.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject place discovery map; this is `AR-GR-90` evidence and must route to an adjacent archetype.
- Reject live situation map; this is `AR-GR-91` evidence and must route to an adjacent archetype.
- Reject generic canvas; this is `AR-GR-92` evidence and must route to an adjacent archetype.
- Reject dashboard; this is `AR-GR-93` evidence and must route to an adjacent archetype.
- Reject a candidate whose only difference is product noun, count, density, color, component, or state as `duplicate-or-variation`.

### Boundary verdict

Return `accept` only when the dominant task, complete region graph, mandatory owner relationship, and compact interaction parity all hold. Return `reject` for any rejection code. Return `needs-evidence` when a required owner or relationship is unresolved.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permissions, actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow realization, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports task relationships, adaptive behavior, and accessibility obligations; it does not name StarCi owners, select exact geometry, or grant permission to copy a source interface. The sources were opened and verified as current official pages during this batch.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [OGC — Web Coverage Service](https://www.ogc.org/standards/wcs/) | Supports coverage, subset, and raster-value concepts. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [USGS — LCMAP science products](https://www.usgs.gov/data/land-change-monitoring-assessment-and-projection-science-products) | Supports official raster-derived land-change products. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ESA — SNAP toolbox](https://step.esa.int/main/toolboxes/snap/) | Supports independent raster and Earth-observation analysis context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports bounded map overflow and reflowing controls. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "geospatial-raster-layer-analysis-workbench",
  "situationCodes": ["<matched AR-GR-* codes>"],
  "searchAliases": ["raster analysis","band algebra","cell query","transect profile"],
  "dominantTask": "Analyze co-registered raster bands or layers through cell values, algebra, distributions, and transect profiles.",
  "regions": ["raster-workbench","coverage-and-time-context","layer-and-band-algebra-stack","raster-map-stage","legend-and-histogram","point-or-area-query","transect-profile","derived-result-and-export"],
  "regionRelationships": ["Raster cells, the formula stack, and numeric distributions or profiles are peer owners under one registered coverage and selection."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "raster-workbench → coverage-and-time-context → layer-and-band-algebra-stack → raster-map-stage → legend-and-histogram → point-or-area-query → transect-profile → derived-result-and-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "raster-map-stage",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["coverage loading","coverage no data","layer hidden","layer error","formula valid","formula invalid","formula calculating","cell selected","cell masked","transect draft","transect ready","histogram stale","result pending","result failure","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

