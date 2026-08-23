# Microplate dose-response analysis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `microplate-dose-response-analysis-workbench` |
| Family | Work |
| Dominant task | Reconcile a physical well layout, spatial quality evidence, and fitted dose-response curves before accepting an assay plate or batch. |
| Search aliases | `dose response`, `microplate QC`, `well grid`, `curve fitting` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Physical well coordinates and fitted dose-series evidence are peer owners; spatial controls and curve quality jointly constrain batch acceptance.
- The required region graph remains `dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Physical wells plus fitted dose-series quality control are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-MD-01` | The dominant task is: Reconcile a physical well layout, spatial quality evidence, and fitted dose-response curves before accepting an assay plate or batch. | Candidate evidence. |
| `AR-MD-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-MD-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-MD-04` | Physical wells plus fitted dose-series quality control are mandatory. | Required relationship evidence. |
| `AR-MD-90` | The dominant task is spreadsheet grid. | Reject. |
| `AR-MD-91` | The dominant task is cohort heatmap. | Reject. |
| `AR-MD-92` | The dominant task is generic chart analytics. | Reject. |
| `AR-MD-93` | The dominant task is laboratory protocol runner. | Reject. |

### Selection rule

Select `microplate-dose-response-analysis-workbench` only when `AR-MD-01`, `AR-MD-02`, `AR-MD-03`, and `AR-MD-04` are evidenced and none of the `AR-MD-90` through `AR-MD-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
dose-response-workbench
└─ plate-and-batch-context
   └─ well-grid-and-controls
      └─ spatial-qc-heatmap
         └─ dose-series-groups
            └─ fitted-response-curves
               └─ outlier-and-edge-effect-queue
                  └─ selected-well-raw-read
                     └─ acceptance-and-report
```

- Required relationship: Physical well coordinates and fitted dose-series evidence are peer owners; spatial controls and curve quality jointly constrain batch acceptance.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `dose-response-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `plate-and-batch-context` | Owns the evidence, state, and action for plate and batch context without borrowing product semantics. | Follows `dose-response-workbench` in semantic order and retains the same selection context. |
| `well-grid-and-controls` | Owns the evidence, state, and action for well grid and controls without borrowing product semantics. | Follows `plate-and-batch-context` in semantic order and retains the same selection context. |
| `spatial-qc-heatmap` | Owns the evidence, state, and action for spatial qc heatmap without borrowing product semantics. | Follows `well-grid-and-controls` in semantic order and retains the same selection context. |
| `dose-series-groups` | Owns the evidence, state, and action for dose series groups without borrowing product semantics. | Follows `spatial-qc-heatmap` in semantic order and retains the same selection context. |
| `fitted-response-curves` | Owns the evidence, state, and action for fitted response curves without borrowing product semantics. | Follows `dose-series-groups` in semantic order and retains the same selection context. |
| `outlier-and-edge-effect-queue` | Owns the evidence, state, and action for outlier and edge effect queue without borrowing product semantics. | Follows `fitted-response-curves` in semantic order and retains the same selection context. |
| `selected-well-raw-read` | Owns the evidence, state, and action for selected well raw read without borrowing product semantics. | Follows `outlier-and-edge-effect-queue` in semantic order and retains the same selection context. |
| `acceptance-and-report` | Owns the evidence, state, and action for acceptance and report without borrowing product semantics. | Follows `selected-well-raw-read` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the plate grid, fitted curves, and QC or outlier evidence visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `well-grid-and-controls` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make plate or curve primary while the selected series and well summary persists.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `well-grid-and-controls` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use QC verdict → dose-series list → fitted curve or numeric table → selected well → accept or reject; make the grid an optional bounded view.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `well-grid-and-controls` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report`.
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
- The fictional batch is blocked while the high control fails.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `plate-and-batch-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `well-grid-and-controls` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `spatial-qc-heatmap` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `dose-series-groups` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `fitted-response-curves` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `acceptance-and-report` | Prevent duplicate action and announce progress without moving focus. |
| Success | `acceptance-and-report` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `plate-and-batch-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `acceptance-and-report` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `dose-response-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: plate loading, control pass, control fail, well missing, well outlier, edge effect suspected, curve fitting, curve passed, curve failed, parameter confidence low, series accepted, series rejected, batch pending, batch accepted, batch rejected.

## Boundaries

### Accept

- Accept when reconcile a physical well layout, spatial quality evidence, and fitted dose-response curves before accepting an assay plate or batch.
- Accept when physical well coordinates and fitted dose-series evidence are peer owners; spatial controls and curve quality jointly constrain batch acceptance.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject spreadsheet grid; this is `AR-MD-90` evidence and must route to an adjacent archetype.
- Reject cohort heatmap; this is `AR-MD-91` evidence and must route to an adjacent archetype.
- Reject generic chart analytics; this is `AR-MD-92` evidence and must route to an adjacent archetype.
- Reject laboratory protocol runner; this is `AR-MD-93` evidence and must route to an adjacent archetype.
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
| [NIH — Assay Guidance Manual](https://www.ncbi.nlm.nih.gov/books/NBK83783/?report=reader) | Supports assay validation, controls, and dose-response practice. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FDA — Q2(R2) Validation of Analytical Procedures](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/q2r2-validation-analytical-procedures) | Supports analytical procedure validation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Supports independent data provenance. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard access for bounded well matrices. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "microplate-dose-response-analysis-workbench",
  "situationCodes": ["<matched AR-MD-* codes>"],
  "searchAliases": ["dose response","microplate QC","well grid","curve fitting"],
  "dominantTask": "Reconcile a physical well layout, spatial quality evidence, and fitted dose-response curves before accepting an assay plate or batch.",
  "regions": ["dose-response-workbench","plate-and-batch-context","well-grid-and-controls","spatial-qc-heatmap","dose-series-groups","fitted-response-curves","outlier-and-edge-effect-queue","selected-well-raw-read","acceptance-and-report"],
  "regionRelationships": ["Physical well coordinates and fitted dose-series evidence are peer owners; spatial controls and curve quality jointly constrain batch acceptance."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dose-response-workbench → plate-and-batch-context → well-grid-and-controls → spatial-qc-heatmap → dose-series-groups → fitted-response-curves → outlier-and-edge-effect-queue → selected-well-raw-read → acceptance-and-report",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "well-grid-and-controls",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["plate loading","control pass","control fail","well missing","well outlier","edge effect suspected","curve fitting","curve passed","curve failed","parameter confidence low","series accepted","series rejected","batch pending","batch accepted","batch rejected"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

