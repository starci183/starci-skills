# Orthogonal volume slice inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `orthogonal-volume-slice-inspector` |
| Family | Detail |
| Dominant task | Locate and measure a structure inside a volume by navigating three orthogonal planes that share one crosshair coordinate. |
| Search aliases | `orthogonal slices`, `MPR inspector`, `volume crosshair`, `axial coronal sagittal` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Axial, coronal, and sagittal views render independently but share one three-dimensional crosshair coordinate and finding identity.
- The required region graph remains `volume-inspector → volume-and-series-context → axial-view → coronal-view → sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Three orthogonal planes sharing one three-dimensional coordinate are invariant.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-OV-01` | The dominant task is: Locate and measure a structure inside a volume by navigating three orthogonal planes that share one crosshair coordinate. | Candidate evidence. |
| `AR-OV-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-OV-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-OV-04` | Three orthogonal planes sharing one three-dimensional coordinate are invariant. | Required relationship evidence. |
| `AR-OV-90` | The dominant task is generic canvas inspector. | Reject. |
| `AR-OV-91` | The dominant task is gallery lightbox. | Reject. |
| `AR-OV-92` | The dominant task is media annotation. | Reject. |
| `AR-OV-93` | The dominant task is map. | Reject. |

### Selection rule

Select `orthogonal-volume-slice-inspector` only when `AR-OV-01`, `AR-OV-02`, `AR-OV-03`, and `AR-OV-04` are evidenced and none of the `AR-OV-90` through `AR-OV-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
volume-inspector
└─ volume-and-series-context
   └─ axial-view
      └─ coronal-view
         └─ sagittal-view
            └─ shared-crosshair-and-coordinate
               └─ optional-3d-overview
                  └─ window-level-and-segmentation
                     └─ measurement-and-finding-list
```

- Required relationship: Axial, coronal, and sagittal views render independently but share one three-dimensional crosshair coordinate and finding identity.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `volume-inspector` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `volume-and-series-context` | Owns the evidence, state, and action for volume and series context without borrowing product semantics. | Follows `volume-inspector` in semantic order and retains the same selection context. |
| `axial-view` | Owns the evidence, state, and action for axial view without borrowing product semantics. | Follows `volume-and-series-context` in semantic order and retains the same selection context. |
| `coronal-view` | Owns the evidence, state, and action for coronal view without borrowing product semantics. | Follows `axial-view` in semantic order and retains the same selection context. |
| `sagittal-view` | Owns the evidence, state, and action for sagittal view without borrowing product semantics. | Follows `coronal-view` in semantic order and retains the same selection context. |
| `shared-crosshair-and-coordinate` | Owns the evidence, state, and action for shared crosshair and coordinate without borrowing product semantics. | Follows `sagittal-view` in semantic order and retains the same selection context. |
| `optional-3d-overview` | Owns the evidence, state, and action for optional 3d overview without borrowing product semantics. | Follows `shared-crosshair-and-coordinate` in semantic order and retains the same selection context. |
| `window-level-and-segmentation` | Owns the evidence, state, and action for window level and segmentation without borrowing product semantics. | Follows `optional-3d-overview` in semantic order and retains the same selection context. |
| `measurement-and-finding-list` | Owns the evidence, state, and action for measurement and finding list without borrowing product semantics. | Follows `window-level-and-segmentation` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Coordinate axial, coronal, sagittal, and optional 3D views while keeping findings available.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `axial-view` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Keep one primary plane with two orientation previews; move findings and controls to a supporting pane.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `axial-view` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Show one plane at a time with explicit orientation switch, coordinate readout, and previous or next slice controls; every gesture has a control equivalent.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `axial-view` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `volume-inspector → volume-and-series-context → axial-view → coronal-view → sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list`.
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
- The fictional finding stores the shared coordinate and remains linked across all orientations.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `volume-and-series-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `axial-view` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `coronal-view` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `sagittal-view` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `shared-crosshair-and-coordinate` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `measurement-and-finding-list` | Prevent duplicate action and announce progress without moving focus. |
| Success | `measurement-and-finding-list` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `volume-and-series-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `measurement-and-finding-list` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `volume-inspector` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: volume loading, volume partial, plane unavailable, crosshair linked, crosshair unlinked, slice boundary, segmentation hidden, segmentation stale, measurement draft, measurement saved, finding selected, orientation restored.

## Boundaries

### Accept

- Accept when locate and measure a structure inside a volume by navigating three orthogonal planes that share one crosshair coordinate.
- Accept when axial, coronal, and sagittal views render independently but share one three-dimensional crosshair coordinate and finding identity.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject generic canvas inspector; this is `AR-OV-90` evidence and must route to an adjacent archetype.
- Reject gallery lightbox; this is `AR-OV-91` evidence and must route to an adjacent archetype.
- Reject media annotation; this is `AR-OV-92` evidence and must route to an adjacent archetype.
- Reject map; this is `AR-OV-93` evidence and must route to an adjacent archetype.
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
| [DICOM — Current Volumetric Presentation State IODs](https://dicom.nema.org/medical/dicom/current/output/chtml/part03/sect_a.80.html) | Supports registered volume inputs and multi-planar reconstruction context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [OME — Data Model overview](https://docs.openmicroscopy.org/ome-model/6.2.2/developers/model-overview.html) | Supports independent multidimensional imaging context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Supports non-drag control alternatives. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum) | Supports focus visibility around persistent controls. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "orthogonal-volume-slice-inspector",
  "situationCodes": ["<matched AR-OV-* codes>"],
  "searchAliases": ["orthogonal slices","MPR inspector","volume crosshair","axial coronal sagittal"],
  "dominantTask": "Locate and measure a structure inside a volume by navigating three orthogonal planes that share one crosshair coordinate.",
  "regions": ["volume-inspector","volume-and-series-context","axial-view","coronal-view","sagittal-view","shared-crosshair-and-coordinate","optional-3d-overview","window-level-and-segmentation","measurement-and-finding-list"],
  "regionRelationships": ["Axial, coronal, and sagittal views render independently but share one three-dimensional crosshair coordinate and finding identity."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "volume-inspector → volume-and-series-context → axial-view → coronal-view → sagittal-view → shared-crosshair-and-coordinate → optional-3d-overview → window-level-and-segmentation → measurement-and-finding-list",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "axial-view",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["volume loading","volume partial","plane unavailable","crosshair linked","crosshair unlinked","slice boundary","segmentation hidden","segmentation stale","measurement draft","measurement saved","finding selected","orientation restored"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

