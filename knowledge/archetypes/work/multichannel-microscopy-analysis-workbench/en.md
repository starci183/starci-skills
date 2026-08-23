# Multichannel microscopy analysis workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `multichannel-microscopy-analysis-workbench` |
| Family | Work |
| Dominant task | Validate segmentation and quantitative measurements by comparing co-registered raw channels, a composite, derived objects, and quality evidence. |
| Search aliases | `microscopy channels`, `segmentation QC`, `object measurements`, `co-registered images` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Raw channels, composite, derived overlay, and measurement table retain distinct authority while sharing one object, plane, and coordinate selection.
- The required region graph remains `microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views → composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Multiple co-registered raw views and traceable raw-to-derived measurement lineage are mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-MM-01` | The dominant task is: Validate segmentation and quantitative measurements by comparing co-registered raw channels, a composite, derived objects, and quality evidence. | Candidate evidence. |
| `AR-MM-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-MM-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-MM-04` | Multiple co-registered raw views and traceable raw-to-derived measurement lineage are mandatory. | Required relationship evidence. |
| `AR-MM-90` | The dominant task is one-canvas property editor. | Reject. |
| `AR-MM-91` | The dominant task is image gallery. | Reject. |
| `AR-MM-92` | The dominant task is media annotation. | Reject. |
| `AR-MM-93` | The dominant task is generic data table. | Reject. |

### Selection rule

Select `multichannel-microscopy-analysis-workbench` only when `AR-MM-01`, `AR-MM-02`, `AR-MM-03`, and `AR-MM-04` are evidenced and none of the `AR-MM-90` through `AR-MM-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
microscopy-workbench
└─ image-dataset-context
   └─ channel-and-plane-controls
      └─ synchronized-raw-channel-views
         └─ composite-stage
            └─ segmentation-and-object-overlay
               └─ object-measurement-table
                  └─ selected-object-profile
                     └─ qc-and-acceptance
```

- Required relationship: Raw channels, composite, derived overlay, and measurement table retain distinct authority while sharing one object, plane, and coordinate selection.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `microscopy-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `image-dataset-context` | Owns the evidence, state, and action for image dataset context without borrowing product semantics. | Follows `microscopy-workbench` in semantic order and retains the same selection context. |
| `channel-and-plane-controls` | Owns the evidence, state, and action for channel and plane controls without borrowing product semantics. | Follows `image-dataset-context` in semantic order and retains the same selection context. |
| `synchronized-raw-channel-views` | Owns the evidence, state, and action for synchronized raw channel views without borrowing product semantics. | Follows `channel-and-plane-controls` in semantic order and retains the same selection context. |
| `composite-stage` | Owns the evidence, state, and action for composite stage without borrowing product semantics. | Follows `synchronized-raw-channel-views` in semantic order and retains the same selection context. |
| `segmentation-and-object-overlay` | Owns the evidence, state, and action for segmentation and object overlay without borrowing product semantics. | Follows `composite-stage` in semantic order and retains the same selection context. |
| `object-measurement-table` | Owns the evidence, state, and action for object measurement table without borrowing product semantics. | Follows `segmentation-and-object-overlay` in semantic order and retains the same selection context. |
| `selected-object-profile` | Owns the evidence, state, and action for selected object profile without borrowing product semantics. | Follows `object-measurement-table` in semantic order and retains the same selection context. |
| `qc-and-acceptance` | Owns the evidence, state, and action for qc and acceptance without borrowing product semantics. | Follows `selected-object-profile` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep raw channels or composite, object measurements, and the selected-object inspector simultaneously available.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `synchronized-raw-channel-views` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make the composite primary; alternate the channel strip and measurement table while retaining the shared object and coordinate.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `synchronized-raw-channel-views` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use field summary → channel switch → overlay → selected-object measurements → QC, with an object list as the default non-visual parity route.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `synchronized-raw-channel-views` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views → composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance`.
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
- The fictional dataset cannot pass QC while one object boundary conflict remains.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `image-dataset-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `channel-and-plane-controls` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `synchronized-raw-channel-views` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `composite-stage` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `segmentation-and-object-overlay` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `qc-and-acceptance` | Prevent duplicate action and announce progress without moving focus. |
| Success | `qc-and-acceptance` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `image-dataset-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `qc-and-acceptance` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `microscopy-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: dataset loading, channel loading, plane unavailable, segmentation running, segmentation stale, segmentation failure, object selected, object rejected, object merged, object split, measurement incomplete, measurement outlier, QC pass, QC fail, QC needs review, acceptance conflict.

## Boundaries

### Accept

- Accept when validate segmentation and quantitative measurements by comparing co-registered raw channels, a composite, derived objects, and quality evidence.
- Accept when raw channels, composite, derived overlay, and measurement table retain distinct authority while sharing one object, plane, and coordinate selection.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject one-canvas property editor; this is `AR-MM-90` evidence and must route to an adjacent archetype.
- Reject image gallery; this is `AR-MM-91` evidence and must route to an adjacent archetype.
- Reject media annotation; this is `AR-MM-92` evidence and must route to an adjacent archetype.
- Reject generic data table; this is `AR-MM-93` evidence and must route to an adjacent archetype.
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
| [OME — Data Model overview](https://docs.openmicroscopy.org/ome-model/6.2.2/developers/model-overview.html) | Supports multidimensional microscopy metadata and relationships. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NCBI — PubChem Structures](https://pubchem.ncbi.nlm.nih.gov/docs/structures) | Supports independent official evidence for structured scientific representation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [DICOM — Current volumetric presentation state IODs](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.80.html) | Supports registered volumetric inputs and presentation context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Complex Images](https://www.w3.org/WAI/tutorials/images/complex/) | Supports text alternatives for complex visual evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "multichannel-microscopy-analysis-workbench",
  "situationCodes": ["<matched AR-MM-* codes>"],
  "searchAliases": ["microscopy channels","segmentation QC","object measurements","co-registered images"],
  "dominantTask": "Validate segmentation and quantitative measurements by comparing co-registered raw channels, a composite, derived objects, and quality evidence.",
  "regions": ["microscopy-workbench","image-dataset-context","channel-and-plane-controls","synchronized-raw-channel-views","composite-stage","segmentation-and-object-overlay","object-measurement-table","selected-object-profile","qc-and-acceptance"],
  "regionRelationships": ["Raw channels, composite, derived overlay, and measurement table retain distinct authority while sharing one object, plane, and coordinate selection."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "microscopy-workbench → image-dataset-context → channel-and-plane-controls → synchronized-raw-channel-views → composite-stage → segmentation-and-object-overlay → object-measurement-table → selected-object-profile → qc-and-acceptance",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "synchronized-raw-channel-views",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["dataset loading","channel loading","plane unavailable","segmentation running","segmentation stale","segmentation failure","object selected","object rejected","object merged","object split","measurement incomplete","measurement outlier","QC pass","QC fail","QC needs review","acceptance conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

