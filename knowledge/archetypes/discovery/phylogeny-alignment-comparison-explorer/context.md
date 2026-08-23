# Phylogeny and alignment comparison explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `phylogeny-alignment-comparison-explorer` |
| Family | Discovery |
| Dominant task | Understand evolutionary relationships by coupling a rooted phylogenetic tree with the corresponding rows and sites of a multiple-sequence alignment. |
| Search aliases | `phylogeny alignment`, `clade site explorer`, `taxa alignment`, `evolutionary comparison` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Clade selection synchronizes taxa rows while site selection synchronizes alignment columns and detail; neither axis may replace the other.
- The required region graph remains `phylogeny-explorer → dataset-and-model-context → phylogenetic-tree → sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- A rooted taxa hierarchy coupled to a two-dimensional aligned residue matrix is mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-PA-01` | The dominant task is: Understand evolutionary relationships by coupling a rooted phylogenetic tree with the corresponding rows and sites of a multiple-sequence alignment. | Candidate evidence. |
| `AR-PA-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-PA-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-PA-04` | A rooted taxa hierarchy coupled to a two-dimensional aligned residue matrix is mandatory. | Required relationship evidence. |
| `AR-PA-90` | The dominant task is generic knowledge graph. | Reject. |
| `AR-PA-91` | The dominant task is two-document parallel reader. | Reject. |
| `AR-PA-92` | The dominant task is hierarchy browser. | Reject. |
| `AR-PA-93` | The dominant task is spreadsheet. | Reject. |

### Selection rule

Select `phylogeny-alignment-comparison-explorer` only when `AR-PA-01`, `AR-PA-02`, `AR-PA-03`, and `AR-PA-04` are evidenced and none of the `AR-PA-90` through `AR-PA-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
phylogeny-explorer
└─ dataset-and-model-context
   └─ phylogenetic-tree
      └─ sequence-alignment-matrix
         └─ site-and-conservation-summary
            └─ selected-clade-metadata
               └─ selected-site-detail
```

- Required relationship: Clade selection synchronizes taxa rows while site selection synchronizes alignment columns and detail; neither axis may replace the other.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `phylogeny-explorer` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `dataset-and-model-context` | Owns the evidence, state, and action for dataset and model context without borrowing product semantics. | Follows `phylogeny-explorer` in semantic order and retains the same selection context. |
| `phylogenetic-tree` | Owns the evidence, state, and action for phylogenetic tree without borrowing product semantics. | Follows `dataset-and-model-context` in semantic order and retains the same selection context. |
| `sequence-alignment-matrix` | Owns the evidence, state, and action for sequence alignment matrix without borrowing product semantics. | Follows `phylogenetic-tree` in semantic order and retains the same selection context. |
| `site-and-conservation-summary` | Owns the evidence, state, and action for site and conservation summary without borrowing product semantics. | Follows `sequence-alignment-matrix` in semantic order and retains the same selection context. |
| `selected-clade-metadata` | Owns the evidence, state, and action for selected clade metadata without borrowing product semantics. | Follows `site-and-conservation-summary` in semantic order and retains the same selection context. |
| `selected-site-detail` | Owns the evidence, state, and action for selected site detail without borrowing product semantics. | Follows `selected-clade-metadata` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Show the rooted tree and alignment together with synchronized taxa and site selection.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `sequence-alignment-matrix` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Narrow or collapse the tree while preserving the selected clade path and alignment coordinates.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `sequence-alignment-matrix` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use tree-first clade drill-down → alignment slice for selected taxa → site or conservation detail; Back restores clade, site, and scroll.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `sequence-alignment-matrix` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `phylogeny-explorer → dataset-and-model-context → phylogenetic-tree → sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail`.
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
- The fictional comparison records both the clade path and the exact alignment site.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `dataset-and-model-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `phylogenetic-tree` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `sequence-alignment-matrix` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `site-and-conservation-summary` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `selected-clade-metadata` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `selected-site-detail` | Prevent duplicate action and announce progress without moving focus. |
| Success | `selected-site-detail` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `dataset-and-model-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `selected-site-detail` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `phylogeny-explorer` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: tree loading, alignment loading, taxon missing, clade collapsed, site selected, site conserved, site variable, site gapped, model metadata unavailable, selection sync failure, download ready.

## Boundaries

### Accept

- Accept when understand evolutionary relationships by coupling a rooted phylogenetic tree with the corresponding rows and sites of a multiple-sequence alignment.
- Accept when clade selection synchronizes taxa rows while site selection synchronizes alignment columns and detail; neither axis may replace the other.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject generic knowledge graph; this is `AR-PA-90` evidence and must route to an adjacent archetype.
- Reject two-document parallel reader; this is `AR-PA-91` evidence and must route to an adjacent archetype.
- Reject hierarchy browser; this is `AR-PA-92` evidence and must route to an adjacent archetype.
- Reject spreadsheet; this is `AR-PA-93` evidence and must route to an adjacent archetype.
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
| [EMBL-EBI — Multiple sequence alignment](https://www.ebi.ac.uk/training/online/courses/guide-to-sequence-analysis-tools/sequence-alignment/multiple-sequence-alignment/) | Supports aligned sequence rows and sites. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NCBI — Tree Viewer](https://www.ncbi.nlm.nih.gov/tools/treeviewer/) | Supports rooted tree navigation and clade context. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [GA4GH — Variation Representation Specification](https://vrs.ga4gh.org/en/stable/) | Supports independent coordinate representation evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports keyboard access to hierarchical tabular structures. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "phylogeny-alignment-comparison-explorer",
  "situationCodes": ["<matched AR-PA-* codes>"],
  "searchAliases": ["phylogeny alignment","clade site explorer","taxa alignment","evolutionary comparison"],
  "dominantTask": "Understand evolutionary relationships by coupling a rooted phylogenetic tree with the corresponding rows and sites of a multiple-sequence alignment.",
  "regions": ["phylogeny-explorer","dataset-and-model-context","phylogenetic-tree","sequence-alignment-matrix","site-and-conservation-summary","selected-clade-metadata","selected-site-detail"],
  "regionRelationships": ["Clade selection synchronizes taxa rows while site selection synchronizes alignment columns and detail; neither axis may replace the other."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "phylogeny-explorer → dataset-and-model-context → phylogenetic-tree → sequence-alignment-matrix → site-and-conservation-summary → selected-clade-metadata → selected-site-detail",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "sequence-alignment-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["tree loading","alignment loading","taxon missing","clade collapsed","site selected","site conserved","site variable","site gapped","model metadata unavailable","selection sync failure","download ready"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

