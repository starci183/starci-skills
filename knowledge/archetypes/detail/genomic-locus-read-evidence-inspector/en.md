# Genomic locus read-evidence inspector

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `genomic-locus-read-evidence-inspector` |
| Family | Detail |
| Dominant task | Determine how aligned reads across samples support or contradict one call at an exact genomic coordinate. |
| Search aliases | `genomic pileup`, `variant read evidence`, `locus inspector`, `allele support` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The exact reference coordinate, per-sample pileups, and allele matrix remain independent evidence owners and synchronize every selection.
- The required region graph remains `locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- A shared reference-coordinate axis with per-sample pileups and an allele-evidence matrix is mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-GL-01` | The dominant task is: Determine how aligned reads across samples support or contradict one call at an exact genomic coordinate. | Candidate evidence. |
| `AR-GL-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-GL-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-GL-04` | A shared reference-coordinate axis with per-sample pileups and an allele-evidence matrix is mandatory. | Required relationship evidence. |
| `AR-GL-90` | The dominant task is distributed trace waterfall. | Reject. |
| `AR-GL-91` | The dominant task is generic evidence dossier. | Reject. |
| `AR-GL-92` | The dominant task is sequence browser. | Reject. |
| `AR-GL-93` | The dominant task is timeline. | Reject. |

### Selection rule

Select `genomic-locus-read-evidence-inspector` only when `AR-GL-01`, `AR-GL-02`, `AR-GL-03`, and `AR-GL-04` are evidenced and none of the `AR-GL-90` through `AR-GL-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
locus-inspector
└─ assembly-and-locus-context
   └─ coordinate-ruler
      └─ reference-and-annotation-tracks
         └─ per-sample-coverage-and-pileups
            └─ allele-evidence-matrix
               └─ selected-read-or-call-detail
                  └─ quality-summary
```

- Required relationship: The exact reference coordinate, per-sample pileups, and allele matrix remain independent evidence owners and synchronize every selection.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `locus-inspector` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `assembly-and-locus-context` | Owns the evidence, state, and action for assembly and locus context without borrowing product semantics. | Follows `locus-inspector` in semantic order and retains the same selection context. |
| `coordinate-ruler` | Owns the evidence, state, and action for coordinate ruler without borrowing product semantics. | Follows `assembly-and-locus-context` in semantic order and retains the same selection context. |
| `reference-and-annotation-tracks` | Owns the evidence, state, and action for reference and annotation tracks without borrowing product semantics. | Follows `coordinate-ruler` in semantic order and retains the same selection context. |
| `per-sample-coverage-and-pileups` | Owns the evidence, state, and action for per sample coverage and pileups without borrowing product semantics. | Follows `reference-and-annotation-tracks` in semantic order and retains the same selection context. |
| `allele-evidence-matrix` | Owns the evidence, state, and action for allele evidence matrix without borrowing product semantics. | Follows `per-sample-coverage-and-pileups` in semantic order and retains the same selection context. |
| `selected-read-or-call-detail` | Owns the evidence, state, and action for selected read or call detail without borrowing product semantics. | Follows `allele-evidence-matrix` in semantic order and retains the same selection context. |
| `quality-summary` | Owns the evidence, state, and action for quality summary without borrowing product semantics. | Follows `selected-read-or-call-detail` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the track stack or pileups and allele evidence matrix visible while selected-read detail remains supporting.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `per-sample-coverage-and-pileups` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make one pileup primary while the sample navigator, exact locus, and quality summary persist.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `per-sample-coverage-and-pileups` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use locus summary → selected sample pileup → allele counts → read detail → quality; every view retains the exact coordinate.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `per-sample-coverage-and-pileups` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary`.
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
- The fictional call remains ambiguous until the low-depth sample is reviewed.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `assembly-and-locus-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `coordinate-ruler` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `reference-and-annotation-tracks` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `per-sample-coverage-and-pileups` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `allele-evidence-matrix` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `quality-summary` | Prevent duplicate action and announce progress without moving focus. |
| Success | `quality-summary` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `assembly-and-locus-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `quality-summary` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `locus-inspector` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: assembly mismatch, locus loading, locus not covered, sample missing, sample low depth, reference evidence, alternate evidence, strand warning, mapping-quality warning, call supported, call ambiguous, call refuted, sample redacted.

## Boundaries

### Accept

- Accept when determine how aligned reads across samples support or contradict one call at an exact genomic coordinate.
- Accept when the exact reference coordinate, per-sample pileups, and allele matrix remain independent evidence owners and synchronize every selection.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject distributed trace waterfall; this is `AR-GL-90` evidence and must route to an adjacent archetype.
- Reject generic evidence dossier; this is `AR-GL-91` evidence and must route to an adjacent archetype.
- Reject sequence browser; this is `AR-GL-92` evidence and must route to an adjacent archetype.
- Reject timeline; this is `AR-GL-93` evidence and must route to an adjacent archetype.
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
| [NCBI — Genome Data Viewer help](https://www.ncbi.nlm.nih.gov/gdv/browser/help/) | Supports coordinate-based genomic navigation and tracks. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [GA4GH — Variation Representation Specification](https://vrs.ga4gh.org/en/stable/) | Supports precise variation and location representation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [EMBL-EBI — Multiple sequence alignment](https://www.ebi.ac.uk/training/online/courses/guide-to-sequence-analysis-tools/sequence-alignment/multiple-sequence-alignment/) | Supports independent sequence-coordinate evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports non-disruptive status announcements. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "genomic-locus-read-evidence-inspector",
  "situationCodes": ["<matched AR-GL-* codes>"],
  "searchAliases": ["genomic pileup","variant read evidence","locus inspector","allele support"],
  "dominantTask": "Determine how aligned reads across samples support or contradict one call at an exact genomic coordinate.",
  "regions": ["locus-inspector","assembly-and-locus-context","coordinate-ruler","reference-and-annotation-tracks","per-sample-coverage-and-pileups","allele-evidence-matrix","selected-read-or-call-detail","quality-summary"],
  "regionRelationships": ["The exact reference coordinate, per-sample pileups, and allele matrix remain independent evidence owners and synchronize every selection."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "locus-inspector → assembly-and-locus-context → coordinate-ruler → reference-and-annotation-tracks → per-sample-coverage-and-pileups → allele-evidence-matrix → selected-read-or-call-detail → quality-summary",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "per-sample-coverage-and-pileups",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["assembly mismatch","locus loading","locus not covered","sample missing","sample low depth","reference evidence","alternate evidence","strand warning","mapping-quality warning","call supported","call ambiguous","call refuted","sample redacted"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

