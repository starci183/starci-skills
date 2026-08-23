# Scientific notebook reproducibility audit

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `scientific-notebook-reproducibility-audit` |
| Family | Detail |
| Dominant task | Prove whether an existing computational notebook reproduces captured outputs from declared data, environment, and execution order. |
| Search aliases | `notebook reproducibility`, `cell lineage audit`, `rerun divergence`, `environment manifest` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- Cell order, data dependencies, environment manifest, and captured outputs remain independent proof owners that converge on the first divergence.
- The required region graph remains `reproducibility-audit → analysis-identity → notebook-cell-sequence → cell-data-dependency-dag → environment-and-lock-manifest → captured-outputs → deterministic-rerun-status → divergence-evidence → reproducibility-receipt`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Finite notebook-cell source hashes, data and environment lineage, topological execution order, and output reproduction are mandatory; no event-prefix cursor exists.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-SN-01` | The dominant task is: Prove whether an existing computational notebook reproduces captured outputs from declared data, environment, and execution order. | Candidate evidence. |
| `AR-SN-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-SN-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-SN-04` | Finite notebook-cell source hashes, data and environment lineage, topological execution order, and output reproduction are mandatory; no event-prefix cursor exists. | Required relationship evidence. |
| `AR-SN-90` | The dominant task is interactive teaching lab. | Reject. |
| `AR-SN-91` | The dominant task is job-run timeline. | Reject. |
| `AR-SN-92` | The dominant task is code diff. | Reject. |
| `AR-SN-93` | The dominant task is notebook editor. | Reject. |
| `AR-SN-94` | The dominant task is event-stream-replay-projection-workbench. | Reject. |

### Selection rule

Select `scientific-notebook-reproducibility-audit` only when `AR-SN-01`, `AR-SN-02`, `AR-SN-03`, and `AR-SN-04` are evidenced and none of the `AR-SN-90` through `AR-SN-94` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
reproducibility-audit
└─ analysis-identity
   └─ notebook-cell-sequence
      └─ cell-data-dependency-dag
         └─ environment-and-lock-manifest
            └─ captured-outputs
               └─ deterministic-rerun-status
                  └─ divergence-evidence
                     └─ reproducibility-receipt
```

- Required relationship: Cell order, data dependencies, environment manifest, and captured outputs remain independent proof owners that converge on the first divergence.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `reproducibility-audit` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `analysis-identity` | Owns the evidence, state, and action for analysis identity without borrowing product semantics. | Follows `reproducibility-audit` in semantic order and retains the same selection context. |
| `notebook-cell-sequence` | Owns the evidence, state, and action for notebook cell sequence without borrowing product semantics. | Follows `analysis-identity` in semantic order and retains the same selection context. |
| `cell-data-dependency-dag` | Owns the evidence, state, and action for cell data dependency dag without borrowing product semantics. | Follows `notebook-cell-sequence` in semantic order and retains the same selection context. |
| `environment-and-lock-manifest` | Owns the evidence, state, and action for environment and lock manifest without borrowing product semantics. | Follows `cell-data-dependency-dag` in semantic order and retains the same selection context. |
| `captured-outputs` | Owns the evidence, state, and action for captured outputs without borrowing product semantics. | Follows `environment-and-lock-manifest` in semantic order and retains the same selection context. |
| `deterministic-rerun-status` | Owns the evidence, state, and action for deterministic rerun status without borrowing product semantics. | Follows `captured-outputs` in semantic order and retains the same selection context. |
| `divergence-evidence` | Owns the evidence, state, and action for divergence evidence without borrowing product semantics. | Follows `deterministic-rerun-status` in semantic order and retains the same selection context. |
| `reproducibility-receipt` | Owns the evidence, state, and action for reproducibility receipt without borrowing product semantics. | Follows `divergence-evidence` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep notebook cells, lineage dependencies, and rerun evidence visible.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `notebook-cell-sequence` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Make the notebook primary; expose environment, lineage, and divergence as named panes.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `notebook-cell-sequence` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use audit summary → first divergent cell → dependencies or input → output comparison → manifest → receipt.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `notebook-cell-sequence` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `reproducibility-audit → analysis-identity → notebook-cell-sequence → cell-data-dependency-dag → environment-and-lock-manifest → captured-outputs → deterministic-rerun-status → divergence-evidence → reproducibility-receipt`.
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
- The fictional receipt fails until cell 07 reproduces under the declared lock manifest.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `analysis-identity` | Identify the pending owner and preserve its semantic position. |
| Ready | `notebook-cell-sequence` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `cell-data-dependency-dag` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `environment-and-lock-manifest` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `captured-outputs` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `reproducibility-receipt` | Prevent duplicate action and announce progress without moving focus. |
| Success | `reproducibility-receipt` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `analysis-identity` | Keep the last safe value and require explicit recovery. |
| Focus transition | `reproducibility-receipt` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `reproducibility-audit` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: manifest missing, data unavailable, data hash mismatch, cell cached, cell running, cell failure, output equal, output divergent, nondeterminism suspected, environment mismatch, rerun cancelled, receipt pass, receipt fail.

## Boundaries

### Accept

- Accept when prove whether an existing computational notebook reproduces captured outputs from declared data, environment, and execution order.
- Accept when cell order, data dependencies, environment manifest, and captured outputs remain independent proof owners that converge on the first divergence.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject interactive teaching lab; this is `AR-SN-90` evidence and must route to an adjacent archetype.
- Reject job-run timeline; this is `AR-SN-91` evidence and must route to an adjacent archetype.
- Reject code diff; this is `AR-SN-92` evidence and must route to an adjacent archetype.
- Reject notebook editor; this is `AR-SN-93` evidence and must route to an adjacent archetype.
- Reject event-stream-replay-projection-workbench; this is `AR-SN-94` evidence and must route to an adjacent archetype.
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
| [Jupyter — Execution](https://docs.jupyter.org/en/latest/projects/execution.html) | Supports notebook execution and output capture. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Workflow Run RO-Crate — Profiles](https://www.researchobject.org/workflow-run-crate/profiles/) | Supports workflow-run provenance and artifacts. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NIST — Research Data Framework](https://www.nist.gov/programs-projects/research-data-framework-rdaf) | Supports independent data provenance and lifecycle evidence. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages) | Supports rerun status without disruptive focus. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "scientific-notebook-reproducibility-audit",
  "situationCodes": ["<matched AR-SN-* codes>"],
  "searchAliases": ["notebook reproducibility","cell lineage audit","rerun divergence","environment manifest"],
  "dominantTask": "Prove whether an existing computational notebook reproduces captured outputs from declared data, environment, and execution order.",
  "regions": ["reproducibility-audit","analysis-identity","notebook-cell-sequence","cell-data-dependency-dag","environment-and-lock-manifest","captured-outputs","deterministic-rerun-status","divergence-evidence","reproducibility-receipt"],
  "regionRelationships": ["Cell order, data dependencies, environment manifest, and captured outputs remain independent proof owners that converge on the first divergence."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "reproducibility-audit → analysis-identity → notebook-cell-sequence → cell-data-dependency-dag → environment-and-lock-manifest → captured-outputs → deterministic-rerun-status → divergence-evidence → reproducibility-receipt",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "notebook-cell-sequence",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["manifest missing","data unavailable","data hash mismatch","cell cached","cell running","cell failure","output equal","output divergent","nondeterminism suspected","environment mismatch","rerun cancelled","receipt pass","receipt fail"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

