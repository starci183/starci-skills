# Earthwork Cut Fill Mass Haul Planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `earthwork-cut-fill-mass-haul-planner` |
| Family | Work |
| Dominant task | Build and approve a construction-stage earthwork movement plan that connects compatible cut sources to fill demands along an alignment, preserves adjusted material volume and exposes balance points, haul limits, borrow, waste and stockpile consequences. |
| Search aliases | `earthwork`, `planner` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The dominant task remains: Build and approve a construction-stage earthwork movement plan that connects compatible cut sources to fill demands along an alignment, preserves adjusted material volume and exposes balance points, haul limits, borrow, waste and stockpile consequences.
- The required region graph remains `mass-haul-planner → alignment-design-version-and-construction-stage → station-range-cut-and-fill-quantity-ledger → material-class-suitability-and-shrink-swell-adjustment → cumulative-mass-curve-and-balance-points ↔ haul-path-cost-barrier-and-stage-access-network → cut-source-to-fill-demand-movement-plan → borrow-waste-and-stockpile-options → plant-environmental-and-sequencing-constraints → revised-movement-plan-and-adjusted-volume-receipt → approved-earthwork-sequence-and-export`.
- The mandatory relationship remains: cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Every realization preserves this acceptance proof: Template must edit cut and fill quantities across multiple station ranges, reject an unsuitable source, apply a visible shrink/swell factor, route compatible material around one haul barrier, update the cumulative balance point, expose borrow or waste for the remaining deficit/surplus and refuse approval until adjusted source, destination, stockpile and residual volumes reconcile.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-B13-12-01` | The dominant task and authority match in full. | Candidate evidence. |
| `AR-B13-12-02` | The complete required region graph is present in semantic order. | Required evidence. |
| `AR-B13-12-03` | Wide, intermediate, and compact preserve the same task, selection, state, and recovery. | Required evidence. |
| `AR-B13-12-04` | The mandatory relationship is evidenced with traceable records. | Required relationship evidence. |
| `AR-B13-12-05` | The acceptance focus works by keyboard and exposes fail, repair, rerun, and success states. | Required interaction evidence. |
| `AR-B13-12-90` | The dominant task is actually `process-mass-balance-analyzer`. | Reject. |
| `AR-B13-12-91` | The dominant task is actually `constrained-quota-allocation-editor`. | Reject. |
| `AR-B13-12-99` | The candidate changes only a product noun, count, density, color, component, or state. | `duplicate-or-variation`. |

### Selection rule

Select `earthwork-cut-fill-mass-haul-planner` only when `AR-B13-12-01` through `AR-B13-12-05` are evidenced and none of `AR-B13-12-90` through `AR-B13-12-99` holds. Return `needs-evidence` when a mandatory owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
mass-haul-planner
└─ alignment-design-version-and-construction-stage
   └─ station-range-cut-and-fill-quantity-ledger
      └─ material-class-suitability-and-shrink-swell-adjustment
         └─ cumulative-mass-curve-and-balance-points
            ↔─ haul-path-cost-barrier-and-stage-access-network
               └─ cut-source-to-fill-demand-movement-plan
                  └─ borrow-waste-and-stockpile-options
                     └─ plant-environmental-and-sequencing-constraints
                        └─ revised-movement-plan-and-adjusted-volume-receipt
                           └─ approved-earthwork-sequence-and-export
```

- Required relationship: cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `mass-haul-planner` | Owns evidence, state, and action for mass haul planner without borrowing product semantics. | Roots the graph and retains the dominant-task state. |
| `alignment-design-version-and-construction-stage` | Owns evidence, state, and action for alignment design version and construction stage without borrowing product semantics. | Follows `mass-haul-planner` in semantic order and receives its verified context. |
| `station-range-cut-and-fill-quantity-ledger` | Owns evidence, state, and action for station range cut and fill quantity ledger without borrowing product semantics. | Follows `alignment-design-version-and-construction-stage` in semantic order and receives its verified context. |
| `material-class-suitability-and-shrink-swell-adjustment` | Owns evidence, state, and action for material class suitability and shrink swell adjustment without borrowing product semantics. | Follows `station-range-cut-and-fill-quantity-ledger` in semantic order and receives its verified context. |
| `cumulative-mass-curve-and-balance-points` | Owns evidence, state, and action for cumulative mass curve and balance points without borrowing product semantics. | Follows `material-class-suitability-and-shrink-swell-adjustment` in semantic order and receives its verified context. |
| `haul-path-cost-barrier-and-stage-access-network` | Owns evidence, state, and action for haul path cost barrier and stage access network without borrowing product semantics. | Synchronizes bidirectionally with `cumulative-mass-curve-and-balance-points` in the same selection context. |
| `cut-source-to-fill-demand-movement-plan` | Owns evidence, state, and action for cut source to fill demand movement plan without borrowing product semantics. | Follows `haul-path-cost-barrier-and-stage-access-network` in semantic order and receives its verified context. |
| `borrow-waste-and-stockpile-options` | Owns evidence, state, and action for borrow waste and stockpile options without borrowing product semantics. | Follows `cut-source-to-fill-demand-movement-plan` in semantic order and receives its verified context. |
| `plant-environmental-and-sequencing-constraints` | Owns evidence, state, and action for plant environmental and sequencing constraints without borrowing product semantics. | Follows `borrow-waste-and-stockpile-options` in semantic order and receives its verified context. |
| `revised-movement-plan-and-adjusted-volume-receipt` | Owns evidence, state, and action for revised movement plan and adjusted volume receipt without borrowing product semantics. | Follows `plant-environmental-and-sequencing-constraints` in semantic order and receives its verified context. |
| `approved-earthwork-sequence-and-export` | Owns evidence, state, and action for approved earthwork sequence and export without borrowing product semantics. | Follows `revised-movement-plan-and-adjusted-volume-receipt` in semantic order and receives its verified context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Alignment quantities, cumulative mass curve, selected source-to-fill movement, haul network, material suitability and conserved-volume receipt remain simultaneously visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** Only the designated table, graph, timeline, or matrix evidence region may own bounded overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** The active balance segment and selected source-fill pair remain primary; full alignment, other stages, plant options and movement history move to synchronized routes.
- **Navigation replacement:** A named route exposes each displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** The bounded evidence region retains overflow; prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Construction stage → deficit fill range → compatible cut source and adjusted volume → haul route/barriers → balance point and haul quantity → borrow/waste/stockpile consequence → conserved receipt → commit movement; the longitudinal diagram transforms into a station-range ledger and one source-to-demand path rather than a miniature chart stack.
- **Navigation replacement:** Explicit Previous, Next, and named-step controls restore selection, state, and scroll context.
- **Sticky boundary:** The step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** Only essential table or graph evidence remains bounded; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `mass-haul-planner → alignment-design-version-and-construction-stage → station-range-cut-and-fill-quantity-ledger → material-class-suitability-and-shrink-swell-adjustment → cumulative-mass-curve-and-balance-points ↔ haul-path-cost-barrier-and-stage-access-network → cut-source-to-fill-demand-movement-plan → borrow-waste-and-stockpile-options → plant-environmental-and-sequencing-constraints → revised-movement-plan-and-adjusted-volume-receipt → approved-earthwork-sequence-and-export`.
- Text zoom, long translation, and enlarged controls trigger the same relationship-driven topology changes.
- CSS never reorders the visual sequence away from keyboard or assistive-technology order.
- Long labels wrap and every hidden region has a named accessible reveal path.
- Ordinary content never creates page-level horizontal scrolling.

### Interaction parity

- Every wide selection, evidence view, action, retry, and recovery remains reachable in intermediate and compact.
- Topology changes preserve the exact selected item, causal path, data state, and pending or completed receipt.
- Dynamic updates announce one contextual status without stealing focus.
- Color, position, geometry, and visual marks have textual or tabular equivalents.
- The acceptance path remains: Template must edit cut and fill quantities across multiple station ranges, reject an unsuitable source, apply a visible shrink/swell factor, route compatible material around one haul barrier, update the cumulative balance point, expose borrow or waste for the remaining deficit/surplus and refuse approval until adjusted source, destination, stockpile and residual volumes reconcile.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `alignment-design-version-and-construction-stage` | Identify the pending owner and preserve its semantic position. |
| Ready | `station-range-cut-and-fill-quantity-ledger` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `material-class-suitability-and-shrink-swell-adjustment` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `cumulative-mass-curve-and-balance-points` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `haul-path-cost-barrier-and-stage-access-network` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `revised-movement-plan-and-adjusted-volume-receipt` | Prevent duplicate action and announce progress without moving focus. |
| Success | `approved-earthwork-sequence-and-export` | Expose the receipt, preserve context, and provide the next valid action. |
| Stale / conflict | `alignment-design-version-and-construction-stage` | Keep the last safe value and require explicit recovery. |
| Focus transition | `approved-earthwork-sequence-and-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `mass-haul-planner` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: design current/superseded, stage locked/open/complete, quantity missing/current/recalculated, material suitable/conditional/unsuitable, shrink-swell factor provisional/approved, balance segment surplus/deficit/balanced, haul path open/constrained/blocked, movement draft/feasible/overallocated, stockpile unavailable/ready/full, borrow or waste unapproved/approved, volume receipt balanced/unbalanced and sequence draft/approved/revised.

## Boundaries

### Accept

- Accept when the dominant task is: Build and approve a construction-stage earthwork movement plan that connects compatible cut sources to fill demands along an alignment, preserves adjusted material volume and exposes balance points, haul limits, borrow, waste and stockpile consequences.
- Accept when the complete region graph and mandatory relationship are evidenced together.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject cho `process-mass-balance-analyzer`, `constrained-quota-allocation-editor`, transport network assignment, timeline scheduler or generic cost optimization; station-indexed cut/fill quantities, material transformations, a cumulative mass curve with balance points, explicit cut-to-fill haul edges, stage-access limits and borrow/waste/stockpile consequences are mandatory.
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
| [Carbon data table](https://carbondesignsystem.com/components/data-table/usage/) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Fluent 2 layout](https://fluent2.microsoft.design/layout) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [WCAG Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [FHWA Earthwork Representation Guide](https://highways.fhwa.dot.gov/federal-lands/design/tools/cfl/earthwork-representation-guide.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Caltrans Construction Manual — Earthwork](https://dot.ca.gov/programs/construction/construction-manual/section-4-19-earthwork) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [UK Planning Inspectorate A12 mass-haul technical note](https://nsip-documents.planninginspectorate.gov.uk/published-documents/TR010060-001649-9-12-Borrow-Pits-Supplementary-Technical-Note-13842-1.pdf) | Supports independent task, layout, interaction, or accessibility evidence relevant to this archetype. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "earthwork-cut-fill-mass-haul-planner",
  "situationCodes": [
    "<matched AR-B13-12-* codes>"
  ],
  "searchAliases": [
    "earthwork",
    "planner"
  ],
  "dominantTask": "Build and approve a construction-stage earthwork movement plan that connects compatible cut sources to fill demands along an alignment, preserves adjusted material volume and exposes balance points, haul limits, borrow, waste and stockpile consequences.",
  "regions": [
    "mass-haul-planner",
    "alignment-design-version-and-construction-stage",
    "station-range-cut-and-fill-quantity-ledger",
    "material-class-suitability-and-shrink-swell-adjustment",
    "cumulative-mass-curve-and-balance-points",
    "haul-path-cost-barrier-and-stage-access-network",
    "cut-source-to-fill-demand-movement-plan",
    "borrow-waste-and-stockpile-options",
    "plant-environmental-and-sequencing-constraints",
    "revised-movement-plan-and-adjusted-volume-receipt",
    "approved-earthwork-sequence-and-export"
  ],
  "relationships": [
    "cumulative balance constrains how much material can move between station ranges, while suitability and access determine which source-to-demand edges are legal."
  ],
  "responsive": {
    "wide": "Alignment quantities, cumulative mass curve, selected source-to-fill movement, haul network, material suitability and conserved-volume receipt remain simultaneously visible.",
    "intermediate": "The active balance segment and selected source-fill pair remain primary; full alignment, other stages, plant options and movement history move to synchronized routes.",
    "compact": "Construction stage → deficit fill range → compatible cut source and adjusted volume → haul route/barriers → balance point and haul quantity → borrow/waste/stockpile consequence → conserved receipt → commit movement; the longitudinal diagram transforms into a station-range ledger and one source-to-demand path rather than a miniature chart stack.",
    "reflow": [
      "mass-haul-planner",
      "alignment-design-version-and-construction-stage",
      "station-range-cut-and-fill-quantity-ledger",
      "material-class-suitability-and-shrink-swell-adjustment",
      "cumulative-mass-curve-and-balance-points",
      "haul-path-cost-barrier-and-stage-access-network",
      "cut-source-to-fill-demand-movement-plan",
      "borrow-waste-and-stockpile-options",
      "plant-environmental-and-sequencing-constraints",
      "revised-movement-plan-and-adjusted-volume-receipt",
      "approved-earthwork-sequence-and-export"
    ]
  },
  "stateObligations": "design current/superseded, stage locked/open/complete, quantity missing/current/recalculated, material suitable/conditional/unsuitable, shrink-swell factor provisional/approved, balance segment surplus/deficit/balanced, haul path open/constrained/blocked, movement draft/feasible/overallocated, stockpile unavailable/ready/full, borrow or waste unapproved/approved, volume receipt balanced/unbalanced and sequence draft/approved/revised.",
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
