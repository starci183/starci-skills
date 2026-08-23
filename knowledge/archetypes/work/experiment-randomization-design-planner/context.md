# Experiment randomization design planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `experiment-randomization-design-planner` |
| Family | Work |
| Dominant task | Create a balanced, sufficiently powered, and reproducibly randomized experimental assignment design before subjects or samples are allocated. |
| Search aliases | `randomization planner`, `design matrix`, `experimental assignment`, `power balance` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The assignment matrix, balance evidence, power evidence, and randomization seed jointly own validity and concealment provenance.
- The required region graph remains `design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- The output must be a randomized assignment matrix with seed and concealment provenance.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-ER-01` | The dominant task is: Create a balanced, sufficiently powered, and reproducibly randomized experimental assignment design before subjects or samples are allocated. | Candidate evidence. |
| `AR-ER-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-ER-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-ER-04` | The output must be a randomized assignment matrix with seed and concealment provenance. | Required relationship evidence. |
| `AR-ER-90` | The dominant task is scenario sensitivity. | Reject. |
| `AR-ER-91` | The dominant task is calendar scheduling. | Reject. |
| `AR-ER-92` | The dominant task is spreadsheet editing. | Reject. |
| `AR-ER-93` | The dominant task is quota allocation. | Reject. |
| `AR-ER-94` | The dominant task is direct waitlist matching. | Reject. |

### Selection rule

Select `experiment-randomization-design-planner` only when `AR-ER-01`, `AR-ER-02`, `AR-ER-03`, and `AR-ER-04` are evidenced and none of the `AR-ER-90` through `AR-ER-94` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
design-planner
└─ study-question-and-population
   └─ factors-treatments-and-strata
      └─ candidate-design-matrix
         └─ balance-and-power-evidence
            └─ block-and-randomization-plan
               └─ seed-and-concealment-record
                  └─ assignment-export
```

- Required relationship: The assignment matrix, balance evidence, power evidence, and randomization seed jointly own validity and concealment provenance.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `design-planner` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `study-question-and-population` | Owns the evidence, state, and action for study question and population without borrowing product semantics. | Follows `design-planner` in semantic order and retains the same selection context. |
| `factors-treatments-and-strata` | Owns the evidence, state, and action for factors treatments and strata without borrowing product semantics. | Follows `study-question-and-population` in semantic order and retains the same selection context. |
| `candidate-design-matrix` | Owns the evidence, state, and action for candidate design matrix without borrowing product semantics. | Follows `factors-treatments-and-strata` in semantic order and retains the same selection context. |
| `balance-and-power-evidence` | Owns the evidence, state, and action for balance and power evidence without borrowing product semantics. | Follows `candidate-design-matrix` in semantic order and retains the same selection context. |
| `block-and-randomization-plan` | Owns the evidence, state, and action for block and randomization plan without borrowing product semantics. | Follows `balance-and-power-evidence` in semantic order and retains the same selection context. |
| `seed-and-concealment-record` | Owns the evidence, state, and action for seed and concealment record without borrowing product semantics. | Follows `block-and-randomization-plan` in semantic order and retains the same selection context. |
| `assignment-export` | Owns the evidence, state, and action for assignment export without borrowing product semantics. | Follows `seed-and-concealment-record` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep design inputs, assignment matrix, and balance or power evidence visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `candidate-design-matrix` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Collapse inputs while the matrix remains primary and the imbalance summary persists.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `candidate-design-matrix` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use define factors → generate design → inspect balance or power → lock seed → review or export; provide a labeled row-group alternative for the matrix.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `candidate-design-matrix` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export`.
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
- The fictional design blocks export until the seed is locked and power is adequate.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `study-question-and-population` | Identify the pending owner and preserve its semantic position. |
| Ready | `factors-treatments-and-strata` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `candidate-design-matrix` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `balance-and-power-evidence` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `block-and-randomization-plan` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `assignment-export` | Prevent duplicate action and announce progress without moving focus. |
| Success | `assignment-export` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `study-question-and-population` | Keep the last safe value and require explicit recovery. |
| Focus transition | `assignment-export` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `design-planner` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: population incomplete, factor invalid, level invalid, design generating, balance pass, balance fail, power insufficient, seed unlocked, seed locked, concealment restricted, export pending, version conflict.

## Boundaries

### Accept

- Accept when create a balanced, sufficiently powered, and reproducibly randomized experimental assignment design before subjects or samples are allocated.
- Accept when the assignment matrix, balance evidence, power evidence, and randomization seed jointly own validity and concealment provenance.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject scenario sensitivity; this is `AR-ER-90` evidence and must route to an adjacent archetype.
- Reject calendar scheduling; this is `AR-ER-91` evidence and must route to an adjacent archetype.
- Reject spreadsheet editing; this is `AR-ER-92` evidence and must route to an adjacent archetype.
- Reject quota allocation; this is `AR-ER-93` evidence and must route to an adjacent archetype.
- Reject direct waitlist matching; this is `AR-ER-94` evidence and must route to an adjacent archetype.
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
| [FDA — Randomized trial design guidance](https://www.fda.gov/media/191123/download) | Supports randomized design and statistical considerations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [CONSORT-SPIRIT — Published statements](https://www.consort-spirit.org/published-statements) | Supports allocation and reporting provenance. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Supports reproducible data records. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) | Supports keyboard access for assignment matrices. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "experiment-randomization-design-planner",
  "situationCodes": ["<matched AR-ER-* codes>"],
  "searchAliases": ["randomization planner","design matrix","experimental assignment","power balance"],
  "dominantTask": "Create a balanced, sufficiently powered, and reproducibly randomized experimental assignment design before subjects or samples are allocated.",
  "regions": ["design-planner","study-question-and-population","factors-treatments-and-strata","candidate-design-matrix","balance-and-power-evidence","block-and-randomization-plan","seed-and-concealment-record","assignment-export"],
  "regionRelationships": ["The assignment matrix, balance evidence, power evidence, and randomization seed jointly own validity and concealment provenance."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "design-planner → study-question-and-population → factors-treatments-and-strata → candidate-design-matrix → balance-and-power-evidence → block-and-randomization-plan → seed-and-concealment-record → assignment-export",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "candidate-design-matrix",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["population incomplete","factor invalid","level invalid","design generating","balance pass","balance fail","power insufficient","seed unlocked","seed locked","concealment restricted","export pending","version conflict"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

