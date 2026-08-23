# Spatial change detection workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `spatial-change-detection-workbench` |
| Family | Work |
| Dominant task | Detect and validate geographic change between two registered observations and review quantities for each derived change region. |
| Search aliases | `change detection`, `before after raster`, `change mask`, `region validation` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The derived spatial mask and quantified change regions own the task while registration quality constrains every verdict.
- The required region graph remains `change-workbench → area-and-time-pair → before-and-after-imagery → registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- A derived spatial mask plus quantified regions is mandatory; a visual before/after comparison alone is insufficient.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SC-01` | The dominant task is: Detect and validate geographic change between two registered observations and review quantities for each derived change region. | Candidate evidence. |
| `AR-SC-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-SC-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-SC-04` | A derived spatial mask plus quantified regions is mandatory; a visual before/after comparison alone is insufficient. | Required relationship evidence. |
| `AR-SC-90` | The dominant task is reconciliation diff. | Reject. |
| `AR-SC-91` | The dominant task is map explorer. | Reject. |
| `AR-SC-92` | The dominant task is media annotation. | Reject. |
| `AR-SC-93` | The dominant task is generic image compare. | Reject. |

### Selection rule

Select `spatial-change-detection-workbench` only when `AR-SC-01`, `AR-SC-02`, `AR-SC-03`, and `AR-SC-04` are evidenced and none of the `AR-SC-90` through `AR-SC-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
change-workbench
└─ area-and-time-pair
   └─ before-and-after-imagery
      └─ registration-quality
         └─ derived-change-mask
            └─ change-region-queue
               └─ selected-region-statistics
                  └─ threshold-and-validation
                     └─ export
```

- Required relationship: The derived spatial mask and quantified change regions own the task while registration quality constrains every verdict.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `change-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `area-and-time-pair` | Owns the evidence, state, and action for area and time pair without borrowing product semantics. | Follows `change-workbench` in semantic order and retains the same selection context. |
| `before-and-after-imagery` | Owns the evidence, state, and action for before and after imagery without borrowing product semantics. | Follows `area-and-time-pair` in semantic order and retains the same selection context. |
| `registration-quality` | Owns the evidence, state, and action for registration quality without borrowing product semantics. | Follows `before-and-after-imagery` in semantic order and retains the same selection context. |
| `derived-change-mask` | Owns the evidence, state, and action for derived change mask without borrowing product semantics. | Follows `registration-quality` in semantic order and retains the same selection context. |
| `change-region-queue` | Owns the evidence, state, and action for change region queue without borrowing product semantics. | Follows `derived-change-mask` in semantic order and retains the same selection context. |
| `selected-region-statistics` | Owns the evidence, state, and action for selected region statistics without borrowing product semantics. | Follows `change-region-queue` in semantic order and retains the same selection context. |
| `threshold-and-validation` | Owns the evidence, state, and action for threshold and validation without borrowing product semantics. | Follows `selected-region-statistics` in semantic order and retains the same selection context. |
| `export` | Owns the evidence, state, and action for export without borrowing product semantics. | Follows `threshold-and-validation` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep before or after imagery, the change mask or queue, and selected statistics visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `before-and-after-imagery` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make imagery primary; alternate region queue and statistics while retaining the selected area summary.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `before-and-after-imagery` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use before or after toggle → change-region list → selected mask or statistics → validate; restore the exact viewport and area of interest.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `before-and-after-imagery` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `change-workbench → area-and-time-pair → before-and-after-imagery → registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export`.
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
- The fictional region with cloud overlap remains uncertain until reviewed.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `area-and-time-pair` | Identify the pending owner and preserve its semantic position. |
| Ready | `before-and-after-imagery` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `registration-quality` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `derived-change-mask` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `change-region-queue` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `export` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `area-and-time-pair` | Keep the last safe value and require explicit recovery. |
| Focus transition | `export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `change-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: imagery loading, imagery clouded, imagery misaligned, registration pass, registration fail, mask calculating, mask stale, region selected, region accepted, region rejected, region uncertain, threshold changed, validation pending, export ready.

## Boundaries

### Accept

- Accept when detect and validate geographic change between two registered observations and review quantities for each derived change region.
- Accept when the derived spatial mask and quantified change regions own the task while registration quality constrains every verdict.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject reconciliation diff; this is `AR-SC-90` evidence and must route to an adjacent archetype.
- Reject map explorer; this is `AR-SC-91` evidence and must route to an adjacent archetype.
- Reject media annotation; this is `AR-SC-92` evidence and must route to an adjacent archetype.
- Reject generic image compare; this is `AR-SC-93` evidence and must route to an adjacent archetype.
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
| [USGS — Continuous Change Detection products](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-lcmap-continuous-change-detection-classification-v13-ccdc) | Supports continuous geographic change detection products. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ESA — SNAP toolbox](https://step.esa.int/main/toolboxes/snap/) | Supports registered Earth-observation processing. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [OGC — Web Coverage Service](https://www.ogc.org/standards/wcs/) | Supports independent coverage and subset semantics. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Supports text equivalents for spatial masks and comparisons. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "spatial-change-detection-workbench",
  "situationCodes": ["<matched AR-SC-* codes>"],
  "searchAliases": ["change detection","before after raster","change mask","region validation"],
  "dominantTask": "Detect and validate geographic change between two registered observations and review quantities for each derived change region.",
  "regions": ["change-workbench","area-and-time-pair","before-and-after-imagery","registration-quality","derived-change-mask","change-region-queue","selected-region-statistics","threshold-and-validation","export"],
  "regionRelationships": ["The derived spatial mask and quantified change regions own the task while registration quality constrains every verdict."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "change-workbench → area-and-time-pair → before-and-after-imagery → registration-quality → derived-change-mask → change-region-queue → selected-region-statistics → threshold-and-validation → export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "before-and-after-imagery",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["imagery loading","imagery clouded","imagery misaligned","registration pass","registration fail","mask calculating","mask stale","region selected","region accepted","region rejected","region uncertain","threshold changed","validation pending","export ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

