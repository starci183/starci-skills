# Sample lineage and custody explorer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `sample-lineage-custody-explorer` |
| Family | Discovery |
| Dominant task | Trace one sample or aliquot through derivation ancestry, custody, location, and use history to establish provenance and integrity. |
| Search aliases | `sample lineage`, `aliquot provenance`, `custody history`, `sample ancestry` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The derivation tree, chronological custody chain, and current location remain separate evidence owners while sharing the selected sample node.
- The required region graph remains `sample-explorer → sample-identity → derivation-lineage-tree → current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Branching derivation and a separately owned custody chronology are mandatory; one generic graph or timeline is insufficient.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SL-01` | The dominant task is: Trace one sample or aliquot through derivation ancestry, custody, location, and use history to establish provenance and integrity. | Candidate evidence. |
| `AR-SL-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-SL-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-SL-04` | Branching derivation and a separately owned custody chronology are mandatory; one generic graph or timeline is insufficient. | Required relationship evidence. |
| `AR-SL-90` | The dominant task is generic knowledge graph. | Reject. |
| `AR-SL-91` | The dominant task is audit timeline. | Reject. |
| `AR-SL-92` | The dominant task is inventory detail. | Reject. |
| `AR-SL-93` | The dominant task is chain-of-custody transfer execution. | Reject. |

### Selection rule

Select `sample-lineage-custody-explorer` only when `AR-SL-01`, `AR-SL-02`, `AR-SL-03`, and `AR-SL-04` are evidenced and none of the `AR-SL-90` through `AR-SL-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
sample-explorer
└─ sample-identity
   └─ derivation-lineage-tree
      └─ current-location-and-inventory
         └─ custody-chain
            └─ assay-and-consumption-links
               └─ integrity-exceptions
                  └─ selected-ancestor-or-descendant-detail
```

- Required relationship: The derivation tree, chronological custody chain, and current location remain separate evidence owners while sharing the selected sample node.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `sample-explorer` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `sample-identity` | Owns the evidence, state, and action for sample identity without borrowing product semantics. | Follows `sample-explorer` in semantic order and retains the same selection context. |
| `derivation-lineage-tree` | Owns the evidence, state, and action for derivation lineage tree without borrowing product semantics. | Follows `sample-identity` in semantic order and retains the same selection context. |
| `current-location-and-inventory` | Owns the evidence, state, and action for current location and inventory without borrowing product semantics. | Follows `derivation-lineage-tree` in semantic order and retains the same selection context. |
| `custody-chain` | Owns the evidence, state, and action for custody chain without borrowing product semantics. | Follows `current-location-and-inventory` in semantic order and retains the same selection context. |
| `assay-and-consumption-links` | Owns the evidence, state, and action for assay and consumption links without borrowing product semantics. | Follows `custody-chain` in semantic order and retains the same selection context. |
| `integrity-exceptions` | Owns the evidence, state, and action for integrity exceptions without borrowing product semantics. | Follows `assay-and-consumption-links` in semantic order and retains the same selection context. |
| `selected-ancestor-or-descendant-detail` | Owns the evidence, state, and action for selected ancestor or descendant detail without borrowing product semantics. | Follows `integrity-exceptions` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the lineage tree and selected node detail visible with an independent custody and location rail.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `derivation-lineage-tree` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make lineage or custody primary while the selected path, current location, and integrity verdict persist.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `derivation-lineage-tree` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use sample summary → ancestor or descendant path → location → custody events → assays or consumption; node switching restores path and scroll context.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `derivation-lineage-tree` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `sample-explorer → sample-identity → derivation-lineage-tree → current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail`.
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
- The fictional integrity verdict remains blocked until the missing handoff is explained.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `sample-identity` | Identify the pending owner and preserve its semantic position. |
| Ready | `derivation-lineage-tree` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `current-location-and-inventory` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `custody-chain` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `assay-and-consumption-links` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `selected-ancestor-or-descendant-detail` | Prevent duplicate action and announce progress without moving focus. |
| Success | `selected-ancestor-or-descendant-detail` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `sample-identity` | Keep the last safe value and require explicit recovery. |
| Focus transition | `selected-ancestor-or-descendant-detail` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `sample-explorer` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: lineage loading, lineage partial, cyclic lineage invalid, aliquot consumed, aliquot available, aliquot missing, custody verified, custody gap, custody disputed, location stale, integrity exception open, integrity exception resolved, permission-redacted event, selected-node recovery.

## Boundaries

### Accept

- Accept when trace one sample or aliquot through derivation ancestry, custody, location, and use history to establish provenance and integrity.
- Accept when the derivation tree, chronological custody chain, and current location remain separate evidence owners while sharing the selected sample node.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject generic knowledge graph; this is `AR-SL-90` evidence and must route to an adjacent archetype.
- Reject audit timeline; this is `AR-SL-91` evidence and must route to an adjacent archetype.
- Reject inventory detail; this is `AR-SL-92` evidence and must route to an adjacent archetype.
- Reject chain-of-custody transfer execution; this is `AR-SL-93` evidence and must route to an adjacent archetype.
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
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Supports research-data lifecycle and provenance considerations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FDA — Data integrity guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/data-integrity-and-compliance-drug-cgmp-questions-and-answers) | Supports data integrity and trustworthy records. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Tree View Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) | Supports keyboard behavior for hierarchical navigation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports meaningful focus order through pane changes. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "sample-lineage-custody-explorer",
  "situationCodes": ["<matched AR-SL-* codes>"],
  "searchAliases": ["sample lineage","aliquot provenance","custody history","sample ancestry"],
  "dominantTask": "Trace one sample or aliquot through derivation ancestry, custody, location, and use history to establish provenance and integrity.",
  "regions": ["sample-explorer","sample-identity","derivation-lineage-tree","current-location-and-inventory","custody-chain","assay-and-consumption-links","integrity-exceptions","selected-ancestor-or-descendant-detail"],
  "regionRelationships": ["The derivation tree, chronological custody chain, and current location remain separate evidence owners while sharing the selected sample node."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "sample-explorer → sample-identity → derivation-lineage-tree → current-location-and-inventory → custody-chain → assay-and-consumption-links → integrity-exceptions → selected-ancestor-or-descendant-detail",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "derivation-lineage-tree",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["lineage loading","lineage partial","cyclic lineage invalid","aliquot consumed","aliquot available","aliquot missing","custody verified","custody gap","custody disputed","location stale","integrity exception open","integrity exception resolved","permission-redacted event","selected-node recovery"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

