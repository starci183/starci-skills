# Inventory replenishment planner

## LOADS

None.

## Record

### Identity

| Field | Value |
|---|---|
| Archetype ID | `inventory-replenishment-planner` |
| Family | Work |
| Dominant task | Turn demand, stock, lead-time, and policy evidence into executable order or transfer recommendations for each item-location. |
| Search aliases | `replenishment recommendation`, `item-location planner`, `stock transfer planner` |
| Authority | Shared product-neutral macro topology; Grammar owns product semantics, Principles own unresolved geometry, and Direction owns visual character. |

### Invariants

- Turn demand, stock, lead-time, and policy evidence into executable order or transfer recommendations for each item-location.
- The recommendation calculation and projected stock and service outcome jointly own the order or transfer decision.
- Every required region retains a separate owner and the same selected context; product nouns do not change the topology.
- Wide, intermediate, and compact preserve meaningful DOM, reading, and focus order, action parity, and deterministic recovery.

## Recognition

### Situation codes

| Code | Situation | Verdict |
|---|---|---|
| `AR-IRP-01` | The dominant task is the required observable outcome. | Required evidence. |
| `AR-IRP-02` | The complete required region graph and named relationships are necessary. | Required evidence. |
| `AR-IRP-03` | Compact preserves wide actions, state, recovery, and focus meaning. | Required evidence. |
| `AR-IRP-04` | Task-specific state can change after the user creates work state. | Required evidence. |
| `AR-IRP-90` | The dominant task is actually capacity overview. | Reject. |
| `AR-IRP-91` | The dominant task is actually scenario sensitivity. | Reject. |
| `AR-IRP-92` | The dominant task is actually quota allocation. | Reject. |
| `AR-IRP-93` | The dominant task is actually spreadsheet. | Reject. |

### Selection rule

Select `inventory-replenishment-planner` if and only if `AR-IRP-01` through `AR-IRP-04` are evidenced and none of `AR-IRP-90` through `AR-IRP-93` holds. Return `needs-evidence` when an owner or relationship is unresolved; return `reject` when a rejection code holds.

## Region graph

```text
replenishment-planner -> network-policy -> item-location-exception-queue -> demand-supply-timeline -> recommendation-calculation -> order-transfer-decision -> projected-stock-service -> release
```

### Region obligations

| Region | Owner and relationship obligation |
|---|---|
| `replenishment-planner` | Owns the dominant task, all descendant state, and the recovery boundary. |
| `network-policy` | Owns Network Policy evidence or action and preserves its declared relationship to the current selection. |
| `item-location-exception-queue` | Owns Item Location Exception Queue evidence or action and preserves its declared relationship to the current selection. |
| `demand-supply-timeline` | Owns Demand Supply Timeline evidence or action and preserves its declared relationship to the current selection. |
| `recommendation-calculation` | Owns Recommendation Calculation evidence or action and preserves its declared relationship to the current selection. |
| `order-transfer-decision` | Owns Order Transfer Decision evidence or action and preserves its declared relationship to the current selection. |
| `projected-stock-service` | Owns Projected Stock Service evidence or action and preserves its declared relationship to the current selection. |
| `release` | Owns Release evidence or action and preserves its declared relationship to the current selection. |

## Responsive contract

### Wide

- **Failure trigger:** Wide ends when simultaneous regions can no longer retain readable labels, exact associations, and complete actions.
- **Topology response:** The exception queue, demand-supply timeline, decision, and projected outcome remain simultaneously visible.
- **Navigation replacement:** None while every required region remains simultaneously usable.
- **Sticky boundary:** Only current-task status or action may persist; it reserves space and yields at short height.
- **Overflow owner:** `demand-supply-timeline` is the only bounded owner on the necessary axis; the page owns no overflow.

### Intermediate

- **Failure trigger:** Intermediate begins when the lowest-priority supporting region makes the primary relationship unusable.
- **Topology response:** The selected item-location stays primary while the exception queue becomes a drawer.
- **Navigation replacement:** A named disclosure or drawer replaces the displaced region and preserves exact selection and trigger.
- **Sticky boundary:** The current verdict or action persists only while its target and status remain visible and returns to flow at short height.
- **Overflow owner:** `demand-supply-timeline` retains bounded overflow; the drawer creates no nested page scroll.

### Compact

- **Failure trigger:** Compact begins when two task regions cannot simultaneously preserve readable evidence, 44-pixel targets, and unobscured focus.
- **Topology response:** Exception list → evidence timeline → recommendation explanation → editable decision → projected outcome → release.
- **Navigation replacement:** A primary-pane sequence with Back restores selection, state, query, scroll context, and the exact trigger.
- **Sticky boundary:** The action bar reserves content space, never obscures focus, and yields to normal flow at short height.
- **Overflow owner:** `demand-supply-timeline` has a textual or list equivalent as primary when its bounded view does not fit.

### Reflow

- Semantic, DOM, and meaningful focus order preserve the graph: `replenishment-planner -> network-policy -> item-location-exception-queue -> demand-supply-timeline -> recommendation-calculation -> order-transfer-decision -> projected-stock-service -> release`.
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

Task-specific states: stock loading, stock stale, shortage, excess, demand spike, lead time unknown, recommendation calculating, recommendation blocked, MOQ conflict, decision accepted, decision overridden, projection below target, release.

| State | Owning region | Obligation |
|---|---|---|
| Initial / loading | `network-policy` | Name the loading scope, reserve the primary region, and block only the failed owner. |
| Ready | `item-location-exception-queue` | Expose the current object, owner relationship, selection, and valid action in text and semantics. |
| Empty / not applicable | `item-location-exception-queue` | Distinguish true empty, no-match, and non-applicable states and provide the valid next action. |
| Error / retry | `projected-stock-service` | Keep valid context and input, name the failed owner, and provide local retry. |
| Permission / unavailable | `release` | Do not imply hidden evidence is absent; explain the restriction and provide a safe exit. |
| Pending | `release` | Prevent duplicate action, retain the exact target, and announce progress without moving focus. |
| Success | `release` | Confirm the exact outcome, preserve selection, and provide the next valid action or recovery. |
| Stale / conflict | `network-policy` | Keep the last safe value, identify the version or time conflict, and require explicit recovery. |
| Focus transition | `release` | Move focus only to a modal or newly required error summary, then return it to the exact trigger. |
| Responsive presentation | `replenishment-planner` | Preserve state, selection, query, pending result, and recovery when topology changes. |

## Boundaries

### Accept

- Accept when the dominant task is: Turn demand, stock, lead-time, and policy evidence into executable order or transfer recommendations for each item-location.
- Accept when every required region and relationship in the graph is necessary to complete the task.
- Accept when compact preserves the task, state, and recovery through a replacement topology instead of stacking desktop boxes.

### Reject

- Reject capacity overview; this is `AR-IRP-90` evidence and must route to an adjacent archetype.
- Reject scenario sensitivity; this is `AR-IRP-91` evidence and must route to an adjacent archetype.
- Reject quota allocation; this is `AR-IRP-92` evidence and must route to an adjacent archetype.
- Reject spreadsheet; this is `AR-IRP-93` evidence and must route to an adjacent archetype.

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
| [SAP — Replenishment](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/9905622a5c1f49ba84e9076fc83a9c2c/2c9fc7536e8e2a4be10000000a174cb4.html) | Item-level replenishment inputs and executable supply actions. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [Oracle Retail Inventory Planning](https://docs.oracle.com/en/industries/retail/retail-inventory-planning-optimization-cloud/26.1.201.0/ipoio/G53785_02.pdf) | Inventory planning, demand, and replenishment recommendations. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [SAP Fiori for Web — Layouts and floorplans](https://www.sap.com/design-system/fiori-design-web/v1-145/page-types/floorplan-overview) | Full-screen and multi-region page relationships for enterprise work. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [W3C WAI — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Status changes announced without moving focus. | Does not select this archetype, define product truth, or authorize copied geometry. |
| [IBM Carbon — Data table](https://carbondesignsystem.com/components/data-table/usage/) | Explicit row-column relationships, selection, and bounded overflow. | Does not select this archetype, define product truth, or authorize copied geometry. |

The source set includes at least three independent official organizations and W3C accessibility evidence.

## Output

```json
{
  "archetypeId": "inventory-replenishment-planner",
  "situationCodes": ["<matched AR-IRP-* codes>"],
  "searchAliases": ["replenishment recommendation","item-location planner","stock transfer planner"],
  "dominantTask": "Turn demand, stock, lead-time, and policy evidence into executable order or transfer recommendations for each item-location.",
  "regions": ["replenishment-planner","network-policy","item-location-exception-queue","demand-supply-timeline","recommendation-calculation","order-transfer-decision","projected-stock-service","release"],
  "regionRelationships": ["The recommendation calculation and projected stock and service outcome jointly own the order or transfer decision."],
  "responsive": {
    "wide": "<simultaneous structure>",
    "intermediate": "<failure and named pane response>",
    "compact": "<primary-pane replacement sequence>",
    "reflow": "<semantic order and text-pressure obligations>",
    "readingOrder": "replenishment-planner -> network-policy -> item-location-exception-queue -> demand-supply-timeline -> recommendation-calculation -> order-transfer-decision -> projected-stock-service -> release",
    "navigationReplacement": "<none or named disclosure, drawer, or primary-pane sequence>",
    "stickyBehavior": "<reserved-space behavior and short-height yield>",
    "overflowOwner": "demand-supply-timeline",
    "interactionParity": "<preserved action, state, selection, focus, and recovery>"
  },
  "stateObligations": ["stock loading","stock stale","shortage","excess","demand spike","lead time unknown","recommendation calculating","recommendation blocked","MOQ conflict","decision accepted","decision overridden","projection below target","release"],
  "boundaryVerdict": "<accept | reject | needs-evidence>",
  "grammarHandoff": ["<product meaning and semantic owners>"],
  "principlesHandoff": ["<unresolved geometry only>"],
  "confidence": "<high | medium | low>",
  "evidence": ["<business or current-source facts>", "<official task research>", "<accessibility research>"]
}
```

