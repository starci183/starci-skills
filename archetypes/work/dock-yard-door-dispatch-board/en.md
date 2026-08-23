# Dock yard door dispatch board

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `dock-yard-door-dispatch-board` |
| Family | Work |
| Dominant task | Coordinate arrivals, yard positions, dock-door time, and trailer moves across spatial and temporal constraints. |
| Search aliases | `yard dispatch board`, `dock door scheduler`, `trailer move control` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Coordinate arrivals, yard positions, dock-door time, and trailer moves across spatial and temporal constraints.
- Each trailer changes physical location state while consuming one compatible door interval.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-DYD-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-DYD-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-DYD-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-DYD-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-DYD-90` | The dominant task is actually calendar scheduler. | Reject. |
| `AR-DYD-91` | The dominant task is actually fleet routing. | Reject. |
| `AR-DYD-92` | The dominant task is actually map monitor. | Reject. |
| `AR-DYD-93` | The dominant task is actually status timeline. | Reject. |

### Selection rule

Select `dock-yard-door-dispatch-board` if and only if `AR-DYD-01` through `AR-DYD-04` are evidenced and none of `AR-DYD-90` through `AR-DYD-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
yard-dispatch -> appointment-arrival-queue -> yard-spatial-stage -> door-time-grid -> trailer-move-queue -> selected-load-constraints -> assign-move-complete -> delay-exception-log
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `yard-dispatch` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `appointment-arrival-queue` | Owns Appointment Arrival Queue evidence or action and preserves its declared relationship to the current selection. |
| `yard-spatial-stage` | Owns Yard Spatial Stage evidence or action and preserves its declared relationship to the current selection. |
| `door-time-grid` | Owns Door Time Grid evidence or action and preserves its declared relationship to the current selection. |
| `trailer-move-queue` | Owns Trailer Move Queue evidence or action and preserves its declared relationship to the current selection. |
| `selected-load-constraints` | Owns Selected Load Constraints evidence or action and preserves its declared relationship to the current selection. |
| `assign-move-complete` | Owns Assign Move Complete evidence or action and preserves its declared relationship to the current selection. |
| `delay-exception-log` | Owns Delay Exception Log evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Yard stage, door timeline, and arrival and move queues remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `door-time-grid` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The timeline or yard view becomes primary with a synchronized state drawer.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `door-time-grid` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Arrival → trailer state and location → eligible doors → move or complete → exception; map and schedule are alternate parity views.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `door-time-grid` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `yard-dispatch -> appointment-arrival-queue -> yard-spatial-stage -> door-time-grid -> trailer-move-queue -> selected-load-constraints -> assign-move-complete -> delay-exception-log`.
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

Task-specific states: arrival expected, arrival early, arrival late, trailer at gate, trailer in yard, trailer at door, trailer departed, door free, door occupied, door blocked, move queued, move active, move failed, constraint conflict, delay exception, completion receipt.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `appointment-arrival-queue` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `yard-spatial-stage` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `yard-spatial-stage` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `assign-move-complete` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `delay-exception-log` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `delay-exception-log` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `delay-exception-log` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `appointment-arrival-queue` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `delay-exception-log` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `yard-dispatch` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Coordinate arrivals, yard positions, dock-door time, and trailer moves across spatial and temporal constraints.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject calendar scheduler; this is `AR-DYD-90` evidence and must route to an adjacent archetype.
- Reject fleet routing; this is `AR-DYD-91` evidence and must route to an adjacent archetype.
- Reject map monitor; this is `AR-DYD-92` evidence and must route to an adjacent archetype.
- Reject status timeline; this is `AR-DYD-93` evidence and must route to an adjacent archetype.

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
| [SAP — Yard Logistics](https://help.sap.com/doc/b934b4e8269d4834a391640bcea9ea9e/2024/en-US/sap_yl-s4h_product_assistance_en.pdf) | Yard location, door assignment, appointment, and trailer move operations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [SAP Fiori for Web — Layouts and floorplans](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Full-screen and multi-region page relationships for enterprise work. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Esri ArcGIS — Application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Synchronized spatial and non-spatial task regions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "dock-yard-door-dispatch-board",
  "situationCodes": ["<matched AR-DYD-* codes>"],
  "searchAliases": ["yard dispatch board","dock door scheduler","trailer move control"],
  "dominantTask": "Coordinate arrivals, yard positions, dock-door time, and trailer moves across spatial and temporal constraints.",
  "regions": ["yard-dispatch","appointment-arrival-queue","yard-spatial-stage","door-time-grid","trailer-move-queue","selected-load-constraints","assign-move-complete","delay-exception-log"],
  "regionRelationships": ["Each trailer changes physical location state while consuming one compatible door interval."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "yard-dispatch -> appointment-arrival-queue -> yard-spatial-stage -> door-time-grid -> trailer-move-queue -> selected-load-constraints -> assign-move-complete -> delay-exception-log",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "door-time-grid",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["arrival expected","arrival early","arrival late","trailer at gate","trailer in yard","trailer at door","trailer departed","door free","door occupied","door blocked","move queued","move active","move failed","constraint conflict","delay exception","completion receipt"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

