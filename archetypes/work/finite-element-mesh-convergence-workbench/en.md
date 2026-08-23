# Finite-element mesh convergence workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `finite-element-mesh-convergence-workbench` |
| Family | Work |
| Dominant task | Establish whether a numerical field solution is mesh-independent enough for its intended quantity of interest by comparing refinement levels, locating discretization error, refining, and rerunning. |
| Search aliases | `mesh convergence`, `grid independence`, `discretization error`, `refinement study` |
| Authority | Shared, product-neutral macro topology. |

### Invariants

- The mesh-level hierarchy keeps one physical-region identity synchronized across geometry, field, and local-error evidence; spatial error localization and cross-level quantity convergence jointly own acceptance.
- The required region graph remains `mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy → geometry-and-mesh-stage → field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt`.
- DOM order, reading order, and meaningful focus order remain identical.
- Grammar owns product meaning; Principles own unresolved geometry; Direction owns visual character.
- Loading, ready, empty, error, unavailable, pending, success, and stale or conflict states preserve the dominant task.
- Linked refinement levels, the same physical region across mesh, field and error views, local discretization error, convergence, and a refinement rerun are all mandatory.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-FM-01` | The dominant task is: Establish whether a numerical field solution is mesh-independent enough for its intended quantity of interest by comparing refinement levels, locating discretization error, refining, and rerunning. | Candidate evidence. |
| `AR-FM-02` | The complete required region graph is semantically present. | Required evidence. |
| `AR-FM-03` | Compact preserves the wide selection, action, state, and recovery. | Required evidence. |
| `AR-FM-04` | Linked refinement levels, the same physical region across mesh, field and error views, local discretization error, convergence, and a refinement rerun are all mandatory. | Required relationship evidence. |
| `AR-FM-90` | The dominant task is scenario-sensitivity-modeler. | Reject. |
| `AR-FM-91` | The dominant task is orthogonal-volume-slice-inspector. | Reject. |
| `AR-FM-92` | The dominant task is generic simulation viewer. | Reject. |
| `AR-FM-93` | The dominant task is job timeline. | Reject. |

### Selection rule

Select `finite-element-mesh-convergence-workbench` only when `AR-FM-01`, `AR-FM-02`, `AR-FM-03`, and `AR-FM-04` are evidenced and none of the `AR-FM-90` through `AR-FM-93` rejection codes holds. Return `needs-evidence` when one required owner or relationship is unknown. Return `reject` when any rejection code holds.

## Region graph

```text
mesh-convergence
└─ analysis-case-boundary-and-material-authority
   └─ mesh-level-hierarchy
      └─ geometry-and-mesh-stage
         └─ field-result-stage
            └─ element-quality-and-local-error-map
               └─ quantity-of-interest-convergence-series
                  └─ refinement-plan-and-cost
                     └─ rerun-and-acceptance-receipt
```

- Required relationship: The mesh-level hierarchy keeps one physical-region identity synchronized across geometry, field, and local-error evidence; spatial error localization and cross-level quantity convergence jointly own acceptance.

### Region obligations

| Region | Owner | Relationship |
|---|---|---|
| `mesh-convergence` | Owns the page-level dominant task and all descendant state. | Root of the graph. |
| `analysis-case-boundary-and-material-authority` | Owns the evidence, state, and action for analysis case boundary and material authority without borrowing product semantics. | Follows `mesh-convergence` in semantic order and retains the same selection context. |
| `mesh-level-hierarchy` | Owns the evidence, state, and action for mesh level hierarchy without borrowing product semantics. | Follows `analysis-case-boundary-and-material-authority` in semantic order and retains the same selection context. |
| `geometry-and-mesh-stage` | Owns the evidence, state, and action for geometry and mesh stage without borrowing product semantics. | Follows `mesh-level-hierarchy` in semantic order and retains the same selection context. |
| `field-result-stage` | Owns the evidence, state, and action for field result stage without borrowing product semantics. | Follows `geometry-and-mesh-stage` in semantic order and retains the same selection context. |
| `element-quality-and-local-error-map` | Owns the evidence, state, and action for element quality and local error map without borrowing product semantics. | Follows `field-result-stage` in semantic order and retains the same selection context. |
| `quantity-of-interest-convergence-series` | Owns the evidence, state, and action for quantity of interest convergence series without borrowing product semantics. | Follows `element-quality-and-local-error-map` in semantic order and retains the same selection context. |
| `refinement-plan-and-cost` | Owns the evidence, state, and action for refinement plan and cost without borrowing product semantics. | Follows `quantity-of-interest-convergence-series` in semantic order and retains the same selection context. |
| `rerun-and-acceptance-receipt` | Owns the evidence, state, and action for rerun and acceptance receipt without borrowing product semantics. | Follows `refinement-plan-and-cost` in semantic order and retains the same selection context. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous evidence owners cannot retain readable labels, exact cross-region associations, and complete actions.
- **Topology response:** Keep the selected mesh, field result, local error or quality evidence, and convergence series simultaneous under one shared level and physical-region identity.
- **Navigation replacement:** None while every simultaneous owner remains usable.
- **Sticky boundary:** Only the active cross-region action may persist; it reserves space and yields when short height cannot keep focus visible.
- **Overflow owner:** `geometry-and-mesh-stage` alone may own bounded two-dimensional overflow when its task meaning requires it.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority persistent region makes the dominant relationship unreadable or inoperable.
- **Topology response:** Keep the selected refinement pair and convergence result primary; alternate geometry and field in one preserved viewport while quality details use a synchronized supporting pane.
- **Navigation replacement:** A named pane control exposes the displaced region with the current selection and state intact.
- **Sticky boundary:** A persistent action remains only while its target and status are visible; it returns to flow at short height.
- **Overflow owner:** `geometry-and-mesh-stage` retains its bounded overflow; displaced prose and controls reflow.

### Compact

- **Failure trigger:** Compact begins when two simultaneous task regions cannot preserve readable evidence and 44-by-44 CSS-pixel controls.
- **Topology response:** Use the sequence quantity of interest → refinement-level pair → worst error zone or element → field/error evidence → refine or rerun → convergence receipt; remove the miniature multi-viewport wall.
- **Navigation replacement:** Explicit Previous, Next, and named-pane controls restore selection, state, and scroll context.
- **Sticky boundary:** The compact step control reserves content space, never obscures focus, and yields at short height.
- **Overflow owner:** `geometry-and-mesh-stage` remains the only bounded exception; all other content uses page scrolling.

### Reflow

- Semantic and DOM order is `mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy → geometry-and-mesh-stage → field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt`.
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
- The fictional run blocks acceptance while the local error remains above 3%.

## State obligations

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `analysis-case-boundary-and-material-authority` | Identify the pending owner and preserve its semantic position. |
| Ready | `mesh-level-hierarchy` | Expose the complete dominant task and synchronized evidence. |
| Empty / not applicable | `geometry-and-mesh-stage` | Distinguish meaningful absence from unavailable evidence. |
| Error / retry | `field-result-stage` | Keep valid context and offer a local retry without resetting selection. |
| Permission / unavailable | `element-quality-and-local-error-map` | Do not imply hidden evidence is absent; provide a safe alternate route. |
| Pending | `rerun-and-acceptance-receipt` | Prevent duplicate action and announce progress without moving focus. |
| Success | `rerun-and-acceptance-receipt` | Expose the result, preserve context, and provide the next valid action. |
| Stale / conflict | `analysis-case-boundary-and-material-authority` | Keep the last safe value and require explicit recovery. |
| Focus transition | `rerun-and-acceptance-receipt` | Move focus only for a modal or error summary, then return it to the trigger. |
| Responsive presentation | `mesh-convergence` | Preserve selection, state, and recovery when topology changes. |

Applicable state family: case incomplete, mesh generating, mesh failure, element invalid, solve pending, solve diverged, quantity unavailable, error estimator stale, convergence monotonic, convergence oscillatory, convergence not reached, cost exceeded, acceptance pending, accepted, rejected.

## Boundaries

### Accept

- Accept when establish whether a numerical field solution is mesh-independent enough for its intended quantity of interest by comparing refinement levels, locating discretization error, refining, and rerunning.
- Accept when the mesh-level hierarchy keeps one physical-region identity synchronized across geometry, field, and local-error evidence; spatial error localization and cross-level quantity convergence jointly own acceptance.
- Accept when compact preserves the exact task evidence, action, and recovery.

### Reject

- Reject scenario-sensitivity-modeler; this is `AR-FM-90` evidence and must route to an adjacent archetype.
- Reject orthogonal-volume-slice-inspector; this is `AR-FM-91` evidence and must route to an adjacent archetype.
- Reject generic simulation viewer; this is `AR-FM-92` evidence and must route to an adjacent archetype.
- Reject job timeline; this is `AR-FM-93` evidence and must route to an adjacent archetype.
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
| [NASA — NASA-STD-7009B](https://standards.nasa.gov/standard/nasa/nasa-std-7009) | Supports model credibility and evidence records. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [ASME — V&V 10](https://www.asme.org/codes-standards/find-codes-standards/standard-for-verification-and-validation-in-computational-solid-mechanics) | Supports computational solid-mechanics verification and validation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NAFEMS — Code verification exemplars](https://www.nafems.org/publications/resource_center/r0135/) | Supports mesh refinement and verification exemplars. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow) | Supports responsive access and bounded two-dimensional exceptions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set represents at least three independent official organizations and includes W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "finite-element-mesh-convergence-workbench",
  "situationCodes": ["<matched AR-FM-* codes>"],
  "searchAliases": ["mesh convergence","grid independence","discretization error","refinement study"],
  "dominantTask": "Establish whether a numerical field solution is mesh-independent enough for its intended quantity of interest by comparing refinement levels, locating discretization error, refining, and rerunning.",
  "regions": ["mesh-convergence","analysis-case-boundary-and-material-authority","mesh-level-hierarchy","geometry-and-mesh-stage","field-result-stage","element-quality-and-local-error-map","quantity-of-interest-convergence-series","refinement-plan-and-cost","rerun-and-acceptance-receipt"],
  "regionRelationships": ["The mesh-level hierarchy keeps one physical-region identity synchronized across geometry, field, and local-error evidence; spatial error localization and cross-level quantity convergence jointly own acceptance."],
  "responsive": {
    "wide": "<simultaneous evidence structure>",
    "intermediate": "<failure and named-pane response>",
    "compact": "<primary-pane sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "mesh-convergence → analysis-case-boundary-and-material-authority → mesh-level-hierarchy → geometry-and-mesh-stage → field-result-stage → element-quality-and-local-error-map → quantity-of-interest-convergence-series → refinement-plan-and-cost → rerun-and-acceptance-receipt",
    "navigationReplacement": "<none or explicit named-pane controls>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "geometry-and-mesh-stage",
    "interactionParity": "<preserved action, state, selection, and recovery>"
  },
  "stateObligations": ["case incomplete","mesh generating","mesh failure","element invalid","solve pending","solve diverged","quantity unavailable","error estimator stale","convergence monotonic","convergence oscillatory","convergence not reached","cost exceeded","acceptance pending","accepted","rejected"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low, with evidence>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

