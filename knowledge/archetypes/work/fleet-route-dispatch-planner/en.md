# Fleet route dispatch planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `fleet-route-dispatch-planner` |
| Family | Work |
| Dominant task | Assign vehicles and jobs, evaluate multi-route feasibility, and dispatch changes under capacity, time-window, and current-position constraints. |
| Search aliases | `fleet dispatch planner`, `vehicle job assignment`, `multi-route optimization` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Assign vehicles and jobs, evaluate multi-route feasibility, and dispatch changes under capacity, time-window, and current-position constraints.
- Many vehicle routes and mutable job assignments remain independent owners synchronized by selected vehicle and job.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-FRD-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-FRD-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-FRD-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-FRD-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-FRD-90` | The dominant task is actually itinerary exploration. | Reject. |
| `AR-FRD-91` | The dominant task is actually map situation monitor. | Reject. |
| `AR-FRD-92` | The dominant task is actually one-resource scheduler. | Reject. |
| `AR-FRD-93` | The dominant task is actually route comparison. | Reject. |

### Selection rule

Select `fleet-route-dispatch-planner` if and only if `AR-FRD-01` through `AR-FRD-04` are evidenced and none of `AR-FRD-90` through `AR-FRD-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
dispatch-planner -> fleet-job-queues -> geographic-route-stage -> route-stop-ledgers -> selected-vehicle-job-constraints -> optimization-alternatives -> manual-overrides -> dispatch-status
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `dispatch-planner` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `fleet-job-queues` | Owns Fleet Job Queues evidence or action and preserves its declared relationship to the current selection. |
| `geographic-route-stage` | Owns Geographic Route Stage evidence or action and preserves its declared relationship to the current selection. |
| `route-stop-ledgers` | Owns Route Stop Ledgers evidence or action and preserves its declared relationship to the current selection. |
| `selected-vehicle-job-constraints` | Owns Selected Vehicle Job Constraints evidence or action and preserves its declared relationship to the current selection. |
| `optimization-alternatives` | Owns Optimization Alternatives evidence or action and preserves its declared relationship to the current selection. |
| `manual-overrides` | Owns Manual Overrides evidence or action and preserves its declared relationship to the current selection. |
| `dispatch-status` | Owns Dispatch Status evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** Map, multi-route ledger, and selected constraints remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `geographic-route-stage` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The route ledger or map becomes primary by task while the other is a synchronized drawer.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `geographic-route-stage` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Vehicle and route list → ordered stops → constraint or override → dispatch; the map is an alternate full-screen view.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `geographic-route-stage` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `dispatch-planner -> fleet-job-queues -> geographic-route-stage -> route-stop-ledgers -> selected-vehicle-job-constraints -> optimization-alternatives -> manual-overrides -> dispatch-status`.
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

Task-specific states: vehicle available, vehicle offline, vehicle full, job unassigned, job assigned, job late, route feasible, route infeasible, optimization running, override conflict, dispatch pending, dispatch sent, dispatch failed, driver acknowledged, location stale.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `fleet-job-queues` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `geographic-route-stage` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `geographic-route-stage` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `manual-overrides` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `dispatch-status` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `dispatch-status` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `dispatch-status` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `fleet-job-queues` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `dispatch-status` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `dispatch-planner` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Assign vehicles and jobs, evaluate multi-route feasibility, and dispatch changes under capacity, time-window, and current-position constraints.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject itinerary exploration; this is `AR-FRD-90` evidence and must route to an adjacent archetype.
- Reject map situation monitor; this is `AR-FRD-91` evidence and must route to an adjacent archetype.
- Reject one-resource scheduler; this is `AR-FRD-92` evidence and must route to an adjacent archetype.
- Reject route comparison; this is `AR-FRD-93` evidence and must route to an adjacent archetype.

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
| [Google — Route Optimization API](https://developers.google.com/maps/documentation/route-optimization) | Assigning tasks and routes to fleets under supplied objectives and constraints. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [SAP — Yard Logistics](https://help.sap.com/doc/b934b4e8269d4834a391640bcea9ea9e/2024/en-US/sap_yl-s4h_product_assistance_en.pdf) | Operational vehicle and location coordination. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Esri ArcGIS — Application layouts](https://developers.arcgis.com/javascript/latest/creating-app-layouts/) | Synchronized spatial and non-spatial task regions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | Non-drag alternatives for movement and reorder actions. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "fleet-route-dispatch-planner",
  "situationCodes": ["<matched AR-FRD-* codes>"],
  "searchAliases": ["fleet dispatch planner","vehicle job assignment","multi-route optimization"],
  "dominantTask": "Assign vehicles and jobs, evaluate multi-route feasibility, and dispatch changes under capacity, time-window, and current-position constraints.",
  "regions": ["dispatch-planner","fleet-job-queues","geographic-route-stage","route-stop-ledgers","selected-vehicle-job-constraints","optimization-alternatives","manual-overrides","dispatch-status"],
  "regionRelationships": ["Many vehicle routes and mutable job assignments remain independent owners synchronized by selected vehicle and job."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "dispatch-planner -> fleet-job-queues -> geographic-route-stage -> route-stop-ledgers -> selected-vehicle-job-constraints -> optimization-alternatives -> manual-overrides -> dispatch-status",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "geographic-route-stage",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["vehicle available","vehicle offline","vehicle full","job unassigned","job assigned","job late","route feasible","route infeasible","optimization running","override conflict","dispatch pending","dispatch sent","dispatch failed","driver acknowledged","location stale"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

