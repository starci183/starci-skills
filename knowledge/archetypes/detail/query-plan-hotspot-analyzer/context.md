# Query-plan hotspot analyzer

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `query-plan-hotspot-analyzer` |
| Family | Detail |
| Dominant task | Explain actual versus estimated query execution and locate the operator causing cardinality, input/output, or cost amplification. |
| Search aliases | `query plan`, `execution hotspot`, `cardinality error`, `operator cost` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Operator data flow and estimate-versus-actual error jointly own diagnosis; ancestry preserves the selected operator through every evidence view.
- The required region graph remains `plan-analyzer → query-and-run-context → operator-plan-tree → estimated-vs-actual-metrics → contribution-profile → hotspot-ranking → selected-operator-input-output → index-and-statistics-evidence → rerun-comparison`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- An operator execution tree with estimate-versus-actual amplification is mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-QP-01` | The dominant task is: Explain actual versus estimated query execution and locate the operator causing cardinality, input/output, or cost amplification. | Candidate evidence. |
| `AR-QP-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-QP-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-QP-04` | An operator execution tree with estimate-versus-actual amplification is mandatory. | Required relationship evidence. |
| `AR-QP-90` | The dominant task is distributed trace waterfall. | Reject. |
| `AR-QP-91` | The dominant task is query builder. | Reject. |
| `AR-QP-92` | The dominant task is dependency monitor. | Reject. |
| `AR-QP-93` | The dominant task is generic profiling. | Reject. |

### Selection rule

Select `query-plan-hotspot-analyzer` only when `AR-QP-01`, `AR-QP-02`, `AR-QP-03`, and `AR-QP-04` are evidenced and none of the `AR-QP-90` through `AR-QP-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
plan-analyzer
└─ query-and-run-context
   └─ operator-plan-tree
      └─ estimated-vs-actual-metrics
         └─ contribution-profile
            └─ hotspot-ranking
               └─ selected-operator-input-output
                  └─ index-and-statistics-evidence
                     └─ rerun-comparison
```

- Required relationship: Operator data flow and estimate-versus-actual error jointly own diagnosis; ancestry preserves the selected operator through every evidence view.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `plan-analyzer` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `query-and-run-context` | Owns the evidence, state, and action for query and run context without borrowing product semantics. | Follows `plan-analyzer` in semantic order and retains the same selection context. |
| `operator-plan-tree` | Owns the evidence, state, and action for operator plan tree without borrowing product semantics. | Follows `query-and-run-context` in semantic order and retains the same selection context. |
| `estimated-vs-actual-metrics` | Owns the evidence, state, and action for estimated vs actual metrics without borrowing product semantics. | Follows `operator-plan-tree` in semantic order and retains the same selection context. |
| `contribution-profile` | Owns the evidence, state, and action for contribution profile without borrowing product semantics. | Follows `estimated-vs-actual-metrics` in semantic order and retains the same selection context. |
| `hotspot-ranking` | Owns the evidence, state, and action for hotspot ranking without borrowing product semantics. | Follows `contribution-profile` in semantic order and retains the same selection context. |
| `selected-operator-input-output` | Owns the evidence, state, and action for selected operator input output without borrowing product semantics. | Follows `hotspot-ranking` in semantic order and retains the same selection context. |
| `index-and-statistics-evidence` | Owns the evidence, state, and action for index and statistics evidence without borrowing product semantics. | Follows `selected-operator-input-output` in semantic order and retains the same selection context. |
| `rerun-comparison` | Owns the evidence, state, and action for rerun comparison without borrowing product semantics. | Follows `index-and-statistics-evidence` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the plan tree, metrics or contribution, and query or operator detail visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `operator-plan-tree` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make tree and hotspot evidence primary while source or query detail becomes temporary.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `operator-plan-tree` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use hotspot list → operator ancestry path → estimate or actual evidence → relevant query fragment → rerun comparison.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `operator-plan-tree` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `plan-analyzer → query-and-run-context → operator-plan-tree → estimated-vs-actual-metrics → contribution-profile → hotspot-ranking → selected-operator-input-output → index-and-statistics-evidence → rerun-comparison`.
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
- The fictional diagnosis ranks node 7 because estimate error amplifies downstream cost.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `query-and-run-context` | Identify the pending owner and preserve its semantic position. |
| Ready | `operator-plan-tree` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `estimated-vs-actual-metrics` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `contribution-profile` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `hotspot-ranking` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `rerun-comparison` | Prevent duplicate action and announce progress without moving focus. |
| Success | `rerun-comparison` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `query-and-run-context` | Keep the last safe value and require explicit recovery. |
| Focus transition | `rerun-comparison` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `plan-analyzer` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: plan loading, plan unsupported, estimate only, actual available, operator normal, operator hot, cardinality error, spill warning, I/O warning, evidence missing, rerun pending, rerun failure, baseline changed.

## Boundaries

### Accept

- Accept when explain actual versus estimated query execution and locate the operator causing cardinality, input/output, or cost amplification.
- Accept when operator data flow and estimate-versus-actual error jointly own diagnosis; ancestry preserves the selected operator through every evidence view.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject distributed trace waterfall; this is `AR-QP-90` evidence and must route to an adjacent archetype.
- Reject query builder; this is `AR-QP-91` evidence and must route to an adjacent archetype.
- Reject dependency monitor; this is `AR-QP-92` evidence and must route to an adjacent archetype.
- Reject generic profiling; this is `AR-QP-93` evidence and must route to an adjacent archetype.
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
| [PostgreSQL — Using EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) | Supports estimated and actual operator plans. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [MySQL — Execution plan information](https://dev.mysql.com/doc/refman/8.4/en/execution-plan-information.html) | Supports independent operator and cost evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Chrome DevTools — Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) | Supports independent hotspot and contribution inspection. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Treegrid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/) | Supports keyboard navigation for operator hierarchies. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "query-plan-hotspot-analyzer",
  "situationCodes": ["<matched AR-QP-* codes>"],
  "searchAliases": ["query plan","execution hotspot","cardinality error","operator cost"],
  "dominantTask": "Explain actual versus estimated query execution and locate the operator causing cardinality, input/output, or cost amplification.",
  "regions": ["plan-analyzer","query-and-run-context","operator-plan-tree","estimated-vs-actual-metrics","contribution-profile","hotspot-ranking","selected-operator-input-output","index-and-statistics-evidence","rerun-comparison"],
  "regionRelationships": ["Operator data flow and estimate-versus-actual error jointly own diagnosis; ancestry preserves the selected operator through every evidence view."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "plan-analyzer → query-and-run-context → operator-plan-tree → estimated-vs-actual-metrics → contribution-profile → hotspot-ranking → selected-operator-input-output → index-and-statistics-evidence → rerun-comparison",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "operator-plan-tree",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["plan loading","plan unsupported","estimate only","actual available","operator normal","operator hot","cardinality error","spill warning","I/O warning","evidence missing","rerun pending","rerun failure","baseline changed"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

