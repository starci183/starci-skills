# Traffic signal phase timing workbench

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `traffic-signal-phase-timing-workbench` |
| Family | Work |
| Dominant task | Author and validate one traffic-signal plan by sequencing compatible movements, tuning phase timing, and preventing vehicle and pedestrian conflicts. |
| Search aliases | `signal timing workbench`, `ring barrier planner`, `phase split editor` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Author and validate one traffic-signal plan by sequencing compatible movements, tuning phase timing, and preventing vehicle and pedestrian conflicts.
- Cyclic ring and barrier phase ownership plus movement conflict and clearance constraints determine validity.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-TSP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-TSP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-TSP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-TSP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-TSP-90` | The dominant task is actually calendar scheduler. | Reject. |
| `AR-TSP-91` | The dominant task is actually workflow node graph. | Reject. |
| `AR-TSP-92` | The dominant task is actually traffic dashboard. | Reject. |
| `AR-TSP-93` | The dominant task is actually generic timeline. | Reject. |

### Selection rule

Select `traffic-signal-phase-timing-workbench` if and only if `AR-TSP-01` through `AR-TSP-04` are evidenced and none of `AR-TSP-90` through `AR-TSP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
signal-timing-workbench -> intersection-movement-model -> movement-conflict-matrix -> ring-barrier-phase-plan -> detector-and-demand-inputs -> split-offset-and-clearance-editor -> progression-and-queue-simulation -> safety-validation -> staged-controller-plan-and-rollback
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `signal-timing-workbench` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `intersection-movement-model` | Owns Intersection Movement Model evidence or action and preserves its declared relationship to the current selection. |
| `movement-conflict-matrix` | Owns Movement Conflict Matrix evidence or action and preserves its declared relationship to the current selection. |
| `ring-barrier-phase-plan` | Owns Ring Barrier Phase Plan evidence or action and preserves its declared relationship to the current selection. |
| `detector-and-demand-inputs` | Owns Detector And Demand Inputs evidence or action and preserves its declared relationship to the current selection. |
| `split-offset-and-clearance-editor` | Owns Split Offset And Clearance Editor evidence or action and preserves its declared relationship to the current selection. |
| `progression-and-queue-simulation` | Owns Progression And Queue Simulation evidence or action and preserves its declared relationship to the current selection. |
| `safety-validation` | Owns Safety Validation evidence or action and preserves its declared relationship to the current selection. |
| `staged-controller-plan-and-rollback` | Owns Staged Controller Plan And Rollback evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Movement model, both rings and barriers, timing editor, simulation, and validation remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `ring-barrier-phase-plan` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The ring and barrier plan and selected-phase editor own the page; movement, detector, and validation evidence alternate without losing phase selection.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `ring-barrier-phase-plan` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Intersection and movement → conflict evidence → ordered phase groups and barriers → timing and clearance → simulate → validate → stage.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `ring-barrier-phase-plan` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `signal-timing-workbench -> intersection-movement-model -> movement-conflict-matrix -> ring-barrier-phase-plan -> detector-and-demand-inputs -> split-offset-and-clearance-editor -> progression-and-queue-simulation -> safety-validation -> staged-controller-plan-and-rollback`.
- Long labels, translation, zoom, and enlarged controls trigger the same named topology changes.
- CSS never reorders semantics; ordinary content creates no page-level horizontal scroll.
- Hidden detail always has an explicit accessible reveal path.

### Interaction parity

- Every wide selection, edit, action, explanation, retry, and recovery remains reachable at intermediate and compact.
- Topology changes preserve the exact selected object, cursor or order, data state, pending result, and error context.
- Pointer actions have keyboard and single-pointer non-drag equivalents when movement is involved.
- Dynamic updates announce one contextual status without stealing focus; color is never the only signal.
- A modal receives and contains focus, supports Escape or Cancel, and returns focus to the exact trigger.

## State obligations

Task-specific states: plan loading, version conflict, movement permitted, movement protected, movement conflicting, detector active, detector failed, phase enabled, phase omitted, split valid, split overallocated, pedestrian clearance sufficient, pedestrian clearance insufficient, barrier synchronized, barrier broken, simulation pending, simulation unstable, simulation pass, deployment staged, deployment failed, rollback available.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `intersection-movement-model` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `movement-conflict-matrix` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `movement-conflict-matrix` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `safety-validation` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `staged-controller-plan-and-rollback` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `staged-controller-plan-and-rollback` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `staged-controller-plan-and-rollback` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `intersection-movement-model` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `staged-controller-plan-and-rollback` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `signal-timing-workbench` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Author and validate one traffic-signal plan by sequencing compatible movements, tuning phase timing, and preventing vehicle and pedestrian conflicts.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject calendar scheduler; this is `AR-TSP-90` evidence and must route to an adjacent archetype.
- Reject workflow node graph; this is `AR-TSP-91` evidence and must route to an adjacent archetype.
- Reject traffic dashboard; this is `AR-TSP-92` evidence and must route to an adjacent archetype.
- Reject generic timeline; this is `AR-TSP-93` evidence and must route to an adjacent archetype.

### Boundary verdict

Return `accept` only when the dominant task, complete graph, and compact parity all hold. Differences limited to noun, density, color, component, card count, or state are `duplicate-or-variation`.

## Handoff

- **Grammar handoff:** Bind product-specific owners, labels, permitted actions, and truthful state meaning to the declared regions.
- **Principles handoff:** Resolve exact grid, measure, gap, alignment, sticky offset, bounded overflow, and relationship-driven transition points.
- Neither handoff may remove a required region, change the dominant task, or weaken interaction parity.

## Non-binding research evidence

### Evidence boundary

External research is advisory evidence, not product truth. It supports synthesis of task relationships, adaptive behavior, and accessibility obligations; it does not select StarCi owners, exact geometry, or permission to copy a source interface.

### Sources

| Source | What it supports | What it does not prove |
|---|---|---|
| [FHWA — Traffic Signal Timing and Operations](https://ops.fhwa.dot.gov/arterial_mgmt/tst_ops.htm) | Movement demand, multimodal timing, and operational validation. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [NTCIP — Published standards](https://www.ntcip.org/document-numbers-and-status/) | Current NTCIP 1202 actuated signal controller standard identity. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Microsoft Fluent 2 — Layout](https://fluent2.microsoft.design/layout) | Adaptive regions and readable pane relationships. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "traffic-signal-phase-timing-workbench",
  "situationCodes": ["<matched AR-TSP-* codes>"],
  "searchAliases": ["signal timing workbench","ring barrier planner","phase split editor"],
  "dominantTask": "Author and validate one traffic-signal plan by sequencing compatible movements, tuning phase timing, and preventing vehicle and pedestrian conflicts.",
  "regions": ["signal-timing-workbench","intersection-movement-model","movement-conflict-matrix","ring-barrier-phase-plan","detector-and-demand-inputs","split-offset-and-clearance-editor","progression-and-queue-simulation","safety-validation","staged-controller-plan-and-rollback"],
  "regionRelationships": ["Cyclic ring and barrier phase ownership plus movement conflict and clearance constraints determine validity."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "signal-timing-workbench -> intersection-movement-model -> movement-conflict-matrix -> ring-barrier-phase-plan -> detector-and-demand-inputs -> split-offset-and-clearance-editor -> progression-and-queue-simulation -> safety-validation -> staged-controller-plan-and-rollback",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "ring-barrier-phase-plan",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["plan loading","version conflict","movement permitted","movement protected","movement conflicting","detector active","detector failed","phase enabled","phase omitted","split valid","split overallocated","pedestrian clearance sufficient","pedestrian clearance insufficient","barrier synchronized","barrier broken","simulation pending","simulation unstable","simulation pass","deployment staged","deployment failed","rollback available"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

