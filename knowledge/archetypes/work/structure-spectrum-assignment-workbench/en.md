# Structure-spectrum assignment workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `structure-spectrum-assignment-workbench` |
| Family | Work |
| Dominant task | Assign peaks from one or more spectra to atoms or groups in a molecular structure while resolving conflicts and completeness gaps. |
| Search aliases | `spectral assignment`, `peak atom mapping`, `structure spectrum`, `assignment completeness` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The atom graph and spectral coordinates are peer owners joined by a many-to-many assignment relation that exposes conflicts and gaps.
- The required region graph remains `assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure → spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- A many-to-many assignment between an atom graph and spectral coordinates is mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SS-01` | The dominant task is: Assign peaks from one or more spectra to atoms or groups in a molecular structure while resolving conflicts and completeness gaps. | Candidate evidence. |
| `AR-SS-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-SS-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-SS-04` | A many-to-many assignment between an atom graph and spectral coordinates is mandatory. | Required relationship evidence. |
| `AR-SS-90` | The dominant task is media annotation. | Reject. |
| `AR-SS-91` | The dominant task is generic graph exploration. | Reject. |
| `AR-SS-92` | The dominant task is data mapping. | Reject. |
| `AR-SS-93` | The dominant task is one-canvas inspection. | Reject. |

### Selection rule

Select `structure-spectrum-assignment-workbench` only when `AR-SS-01`, `AR-SS-02`, `AR-SS-03`, and `AR-SS-04` are evidenced and none of the `AR-SS-90` through `AR-SS-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
assignment-workbench
└─ sample-and-structure-context
   └─ atom-indexed-molecular-structure
      └─ spectral-axes
         └─ peak-list
            └─ atom-to-peak-assignment-matrix
               └─ selected-assignment-evidence
                  └─ conflict-and-completeness-summary
                     └─ finalize
```

- Required relationship: The atom graph and spectral coordinates are peer owners joined by a many-to-many assignment relation that exposes conflicts and gaps.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `assignment-workbench` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `sample-and-structure-context` | Owns the evidence, state, and action for sample and structure context without borrowing product semantics. | Follows `assignment-workbench` in semantic order and retains the same selection context. |
| `atom-indexed-molecular-structure` | Owns the evidence, state, and action for atom indexed molecular structure without borrowing product semantics. | Follows `sample-and-structure-context` in semantic order and retains the same selection context. |
| `spectral-axes` | Owns the evidence, state, and action for spectral axes without borrowing product semantics. | Follows `atom-indexed-molecular-structure` in semantic order and retains the same selection context. |
| `peak-list` | Owns the evidence, state, and action for peak list without borrowing product semantics. | Follows `spectral-axes` in semantic order and retains the same selection context. |
| `atom-to-peak-assignment-matrix` | Owns the evidence, state, and action for atom to peak assignment matrix without borrowing product semantics. | Follows `peak-list` in semantic order and retains the same selection context. |
| `selected-assignment-evidence` | Owns the evidence, state, and action for selected assignment evidence without borrowing product semantics. | Follows `atom-to-peak-assignment-matrix` in semantic order and retains the same selection context. |
| `conflict-and-completeness-summary` | Owns the evidence, state, and action for conflict and completeness summary without borrowing product semantics. | Follows `selected-assignment-evidence` in semantic order and retains the same selection context. |
| `finalize` | Owns the evidence, state, and action for finalize without borrowing product semantics. | Follows `conflict-and-completeness-summary` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep structure, spectrum, and assignment matrix visible together.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `spectral-axes` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make structure or spectrum primary while the active atom/peak pair and completeness summary persist.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `spectral-axes` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use a peak-by-peak sequence: peak → candidate atoms → evidence → assign → next; structure and spectrum become named alternate views.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `spectral-axes` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure → spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize`.
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
- The fictional assignment cannot finalize while one peak has conflicting atoms.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `sample-and-structure-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `atom-indexed-molecular-structure` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `spectral-axes` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `peak-list` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `atom-to-peak-assignment-matrix` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `finalize` | Prevent duplicate action and announce progress without moving focus. |
| Success | `finalize` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `sample-and-structure-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `finalize` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `assignment-workbench` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: spectrum loading, spectrum noisy, peak unpicked, peak selected, peak overlapping, atom assigned, atom unassigned, atom multiply assigned, assignment conflict, low confidence, completeness gap, finalize blocked, finalize success, recalculation stale.

## Boundaries

### Accept

- Accept when assign peaks from one or more spectra to atoms or groups in a molecular structure while resolving conflicts and completeness gaps.
- Accept when the atom graph and spectral coordinates are peer owners joined by a many-to-many assignment relation that exposes conflicts and gaps.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject media annotation; this is `AR-SS-90` evidence and must route to an adjacent archetype.
- Reject generic graph exploration; this is `AR-SS-91` evidence and must route to an adjacent archetype.
- Reject data mapping; this is `AR-SS-92` evidence and must route to an adjacent archetype.
- Reject one-canvas inspection; this is `AR-SS-93` evidence and must route to an adjacent archetype.
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
| [NIST — Chemistry WebBook](https://webbook.nist.gov/) | Supports official spectral reference data. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NCBI — PubChem Structures](https://pubchem.ncbi.nlm.nih.gov/docs/structures) | Supports atom-indexed chemical structures. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IETF — RFC Editor](https://www.rfc-editor.org/) | Supports independent structured-data documentation practice. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports meaningful keyboard order across alternate representations. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "structure-spectrum-assignment-workbench",
  "situationCodes": ["<matched AR-SS-* codes>"],
  "searchAliases": ["spectral assignment","peak atom mapping","structure spectrum","assignment completeness"],
  "dominantTask": "Assign peaks from one or more spectra to atoms or groups in a molecular structure while resolving conflicts and completeness gaps.",
  "regions": ["assignment-workbench","sample-and-structure-context","atom-indexed-molecular-structure","spectral-axes","peak-list","atom-to-peak-assignment-matrix","selected-assignment-evidence","conflict-and-completeness-summary","finalize"],
  "regionRelationships": ["The atom graph and spectral coordinates are peer owners joined by a many-to-many assignment relation that exposes conflicts and gaps."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "assignment-workbench → sample-and-structure-context → atom-indexed-molecular-structure → spectral-axes → peak-list → atom-to-peak-assignment-matrix → selected-assignment-evidence → conflict-and-completeness-summary → finalize",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "spectral-axes",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["spectrum loading","spectrum noisy","peak unpicked","peak selected","peak overlapping","atom assigned","atom unassigned","atom multiply assigned","assignment conflict","low confidence","completeness gap","finalize blocked","finalize success","recalculation stale"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

